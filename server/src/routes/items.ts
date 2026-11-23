import { and, asc, desc, eq, gte, ilike, isNull, lt, lte, or, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth.js";
import { addDays, today } from "../dates.js";
import type { Db } from "../db/index.js";
import { appliances, compartments, items, presets } from "../db/schema.js";
import { HttpError, notFound } from "../http.js";
import { findFree, inBounds, levelFor, loadPlaced, normalizeCompartment } from "../grid.js";
import { assertOwnedPhoto, deletePhotoIfUnused } from "../photos.js";
import { assertCategory, getHouseholdSettings } from "../settings.js";
import { getOwnedAppliance, getOwnedCompartment } from "./appliances.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format JJJJ-MM-TT");

const itemFields = {
  applianceId: z.uuid(),
  compartmentId: z.uuid().nullish(),
  presetId: z.uuid().nullish(),
  name: z.string().trim().min(1).max(80),
  category: z.string().min(1).max(40),
  icon: z.string().trim().max(16).nullish(),
  quantity: z.number().positive().max(1_000_000).nullish(),
  unit: z.string().trim().max(20).nullish(),
  position: z.string().trim().max(80).nullish(),
  note: z.string().trim().max(1000).nullish(),
  storedAt: z.coerce.date().optional(),
  bestBefore: isoDate.nullish(),
  photoId: z.uuid().nullish(),
};

const placementFields = {
  gridX: z.number().int().min(0).max(11),
  gridY: z.number().int().min(0).max(7),
  gridW: z.number().int().min(1).max(12),
  gridH: z.number().int().min(1).max(8),
};

const createBody = z.object({
  ...itemFields,
  // Name/Kategorie dürfen fehlen, wenn ein Preset angegeben ist
  name: itemFields.name.optional(),
  category: itemFields.category.optional(),
  /** Platz im Raster (optional) … */
  ...z.object(placementFields).partial().shape,
  /** … oder automatisch einen freien Platz suchen. */
  autoPlace: z.boolean().optional(),
});
const updateBody = z.object(itemFields).partial();
const idParam = z.object({ id: z.uuid() });

/** Gemeinsame Spaltenauswahl inkl. Gerät- und Fachname. */
const itemColumns = {
  id: items.id,
  applianceId: items.applianceId,
  compartmentId: items.compartmentId,
  presetId: items.presetId,
  name: items.name,
  category: items.category,
  icon: items.icon,
  quantity: items.quantity,
  unit: items.unit,
  position: items.position,
  note: items.note,
  storedAt: items.storedAt,
  bestBefore: items.bestBefore,
  photoId: items.photoId,
  gridX: items.gridX,
  gridY: items.gridY,
  gridW: items.gridW,
  gridH: items.gridH,
  stackLevel: items.stackLevel,
  status: items.status,
  removalReason: items.removalReason,
  removedAt: items.removedAt,
  createdBy: items.createdBy,
  updatedAt: items.updatedAt,
  applianceName: appliances.name,
  applianceType: appliances.type,
  compartmentName: compartments.name,
};

function selectItems(db: Db) {
  return db
    .select(itemColumns)
    .from(items)
    .leftJoin(appliances, eq(appliances.id, items.applianceId))
    .leftJoin(compartments, eq(compartments.id, items.compartmentId));
}

async function getOwnedItem(db: Db, householdId: string, id: string) {
  const [row] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, id), eq(items.householdId, householdId)));
  if (!row) throw notFound("Artikel");
  return row;
}

async function getItemView(db: Db, id: string) {
  const [row] = await selectItems(db).where(eq(items.id, id));
  return row!;
}

/** Prüft, dass das Fach zum Gerät gehört. */
async function checkCompartment(
  db: Db,
  householdId: string,
  applianceId: string,
  compartmentId: string | null | undefined,
) {
  if (!compartmentId) return undefined;
  const c = await getOwnedCompartment(db, householdId, compartmentId);
  if (c.applianceId !== applianceId)
    throw new HttpError(400, "Fach gehört nicht zu diesem Kühlgerät");
  return c;
}

const NO_PLACEMENT = { gridX: null, gridY: null, gridW: null, gridH: null, stackLevel: null };

type Comp = Awaited<ReturnType<typeof getOwnedCompartment>>;

/** Prüft einen Wunschplatz und liefert die Stapelebene – oder wirft 409, wenn kein Platz ist. */
async function resolvePlacement(db: Db, c: Comp, rect: { x: number; y: number; w: number; h: number }, excludeId?: string) {
  if (!inBounds(rect, c))
    throw new HttpError(400, `Platz liegt außerhalb des Fachs (${c.gridCols} × ${c.gridRows} Felder)`);
  const placed = await loadPlaced(db, c.id);
  const level = levelFor(rect, placed, excludeId);
  if (level >= c.maxStack) {
    const free = findFree(c, placed.filter((p) => p.id !== excludeId), rect.w, rect.h);
    throw new HttpError(
      409,
      `Hier ist kein Platz mehr – höchstens ${c.maxStack} übereinander` +
        (free ? `. Frei wäre Spalte ${free.x + 1}, Reihe ${free.y + 1}.` : ". Das Fach ist für diese Größe voll."),
    );
  }
  return level;
}

const escapeLike = (s: string) => s.replace(/[%_\\]/g, "\\$&");

export async function itemRoutes(app: FastifyInstance, db: Db) {
  /* ---------------- Liste ---------------- */
  app.get("/api/items", async (req) => {
    const user = requireUser(req);
    const q = z
      .object({
        status: z.enum(["active", "archived"]).default("active"),
        applianceId: z.uuid().optional(),
        compartmentId: z.uuid().optional(),
        q: z.string().trim().max(80).optional(),
        expiry: z.enum(["soon", "expired", "due"]).optional(),
        sort: z.enum(["bestBefore", "storedAt", "name", "removedAt"]).optional(),
        limit: z.coerce.number().int().min(1).max(500).default(200),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(req.query);

    const t = today();
    const { expiringSoonDays } = await getHouseholdSettings(db, user.householdId);
    const soon = addDays(t, expiringSoonDays);
    const where: SQL[] = [eq(items.householdId, user.householdId), eq(items.status, q.status)];
    if (q.applianceId) where.push(eq(items.applianceId, q.applianceId));
    if (q.compartmentId) where.push(eq(items.compartmentId, q.compartmentId));
    if (q.q) where.push(ilike(items.name, `%${escapeLike(q.q)}%`));
    if (q.expiry === "expired") where.push(lt(items.bestBefore, t));
    if (q.expiry === "soon") where.push(and(gte(items.bestBefore, t), lte(items.bestBefore, soon))!);
    if (q.expiry === "due") where.push(lte(items.bestBefore, soon));

    const sort = q.sort ?? (q.status === "archived" ? "removedAt" : "bestBefore");
    const order = {
      // Artikel ohne MHD ans Ende
      bestBefore: [asc(isNull(items.bestBefore)), asc(items.bestBefore), asc(items.name)],
      storedAt: [desc(items.storedAt)],
      name: [asc(items.name)],
      removedAt: [desc(items.removedAt)],
    }[sort];

    return selectItems(db)
      .where(and(...where))
      .orderBy(...order)
      .limit(q.limit)
      .offset(q.offset);
  });

  app.get("/api/items/:id", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    await getOwnedItem(db, user.householdId, id);
    return getItemView(db, id);
  });

  /* ---------------- Anlegen ---------------- */
  app.post("/api/items", async (req, reply) => {
    const user = requireUser(req);
    const body = createBody.parse(req.body);
    const appliance = await getOwnedAppliance(db, user.householdId, body.applianceId);
    const comp = await checkCompartment(db, user.householdId, appliance.id, body.compartmentId);
    if (body.photoId) await assertOwnedPhoto(db, user.householdId, body.photoId);
    await assertCategory(db, user.householdId, body.category);

    let preset: typeof presets.$inferSelect | undefined;
    if (body.presetId) {
      [preset] = await db
        .select()
        .from(presets)
        .where(
          and(
            eq(presets.id, body.presetId),
            or(isNull(presets.householdId), eq(presets.householdId, user.householdId)),
          ),
        );
      if (!preset) throw notFound("Preset");
    }

    const name = body.name ?? preset?.name;
    if (!name) throw new HttpError(400, "Name fehlt");

    // MHD aus Preset vorschlagen, wenn nicht explizit angegeben (null = bewusst kein MHD).
    // Ein Gefrierfach im Kühlschrank (Kombi) zählt als Tiefkühler.
    const zone = comp?.zone ?? appliance.type;
    let bestBefore = body.bestBefore;
    if (bestBefore === undefined && preset) {
      const d = zone === "freezer" ? preset.shelfLifeFreezerDays : preset.shelfLifeFridgeDays;
      bestBefore = d != null ? addDays(today(body.storedAt), d) : null;
    }

    // Platz im Raster
    let placement: Record<string, number | null> = NO_PLACEMENT;
    if (comp && body.gridX !== undefined && body.gridY !== undefined) {
      const rect = { x: body.gridX, y: body.gridY, w: body.gridW ?? preset?.gridW ?? 1, h: body.gridH ?? preset?.gridH ?? 1 };
      placement = { gridX: rect.x, gridY: rect.y, gridW: rect.w, gridH: rect.h, stackLevel: await resolvePlacement(db, comp, rect) };
    } else if (comp && body.autoPlace) {
      const free = findFree(comp, await loadPlaced(db, comp.id), body.gridW ?? preset?.gridW ?? 1, body.gridH ?? preset?.gridH ?? 1);
      if (free) placement = { gridX: free.x, gridY: free.y, gridW: free.w, gridH: free.h, stackLevel: free.level };
    }

    const [created] = await db
      .insert(items)
      .values({
        householdId: user.householdId,
        applianceId: appliance.id,
        compartmentId: body.compartmentId ?? null,
        presetId: preset?.id ?? null,
        name,
        category: body.category ?? (preset?.category as typeof body.category) ?? "other",
        icon: body.icon !== undefined ? body.icon : (preset?.icon ?? null),
        quantity: body.quantity !== undefined ? body.quantity : (preset?.defaultQuantity ?? null),
        unit: body.unit !== undefined ? body.unit : (preset?.defaultUnit ?? null),
        position: body.position ?? null,
        note: body.note ?? null,
        storedAt: body.storedAt ?? new Date(),
        bestBefore: bestBefore ?? null,
        photoId: body.photoId !== undefined ? body.photoId : (preset?.photoId ?? null),
        ...placement,
        createdBy: user.id,
      })
      .returning({ id: items.id });
    return reply.status(201).send(await getItemView(db, created!.id));
  });

  /* ---------------- Bearbeiten / Umlagern ---------------- */
  app.patch("/api/items/:id", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    const body = updateBody.parse(req.body);
    const old = await getOwnedItem(db, user.householdId, id);

    const applianceId = body.applianceId ?? old.applianceId;
    if (body.applianceId) await getOwnedAppliance(db, user.householdId, body.applianceId);
    // Gerät gewechselt, aber kein neues Fach → Fach zurücksetzen
    if (body.applianceId && body.applianceId !== old.applianceId && body.compartmentId === undefined)
      body.compartmentId = null;
    if (applianceId) await checkCompartment(db, user.householdId, applianceId, body.compartmentId);
    if (body.photoId) await assertOwnedPhoto(db, user.householdId, body.photoId);
    await assertCategory(db, user.householdId, body.category);

    // In ein anderes Fach verlegt → Rasterplatz zurücksetzen
    const moved = body.compartmentId !== undefined && body.compartmentId !== old.compartmentId;
    await db
      .update(items)
      .set({ ...body, ...(moved ? NO_PLACEMENT : {}) })
      .where(eq(items.id, id));
    if (moved) await normalizeCompartment(db, old.compartmentId);
    if (body.photoId !== undefined && body.photoId !== old.photoId)
      await deletePhotoIfUnused(db, old.photoId);
    return getItemView(db, id);
  });

  /* ---------------- Entnehmen ---------------- */
  app.post("/api/items/:id/remove", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        reason: z.enum(["consumed", "discarded", "given_away", "other"]).default("consumed"),
        /** Teilentnahme: nur diese Menge entnehmen. */
        quantity: z.number().positive().optional(),
      })
      .parse(req.body ?? {});
    const item = await getOwnedItem(db, user.householdId, id);
    if (item.status !== "active") throw new HttpError(409, "Artikel ist bereits entnommen");

    const now = new Date();
    const partial =
      body.quantity !== undefined && item.quantity != null && body.quantity < item.quantity;

    if (!partial) {
      await db
        .update(items)
        .set({ status: "archived", removalReason: body.reason, removedAt: now })
        .where(eq(items.id, id));
      // Was darauf gestapelt war, rutscht nach unten
      await normalizeCompartment(db, item.compartmentId);
      return { archivedId: id, partial: false, remainingQuantity: null };
    }

    // Teilentnahme: Restmenge bleibt, entnommene Menge wird als Archiv-Eintrag gespeichert
    const remaining = Math.round((item.quantity! - body.quantity!) * 1000) / 1000;
    const archivedId = await db.transaction(async (tx) => {
      await tx.update(items).set({ quantity: remaining }).where(eq(items.id, id));
      const { id: _old, updatedAt: _u, ...copy } = item;
      const [a] = await tx
        .insert(items)
        .values({
          ...copy,
          quantity: body.quantity!,
          ...NO_PLACEMENT,
          status: "archived",
          removalReason: body.reason,
          removedAt: now,
          createdBy: user.id,
        })
        .returning({ id: items.id });
      return a!.id;
    });
    return { archivedId, partial: true, remainingQuantity: remaining };
  });

  /* ---------------- Wiederherstellen ---------------- */
  app.post("/api/items/:id/restore", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        applianceId: z.uuid().optional(),
        compartmentId: z.uuid().nullish(),
        /** Bei Teilentnahme: Menge zurück in diesen aktiven Artikel buchen. */
        mergeIntoId: z.uuid().optional(),
      })
      .parse(req.body ?? {});
    const item = await getOwnedItem(db, user.householdId, id);
    if (item.status !== "archived") throw new HttpError(409, "Artikel ist nicht im Archiv");

    if (body.mergeIntoId) {
      const target = await getOwnedItem(db, user.householdId, body.mergeIntoId);
      if (target.status === "active" && target.quantity != null && item.quantity != null) {
        await db.transaction(async (tx) => {
          await tx
            .update(items)
            .set({ quantity: Math.round((target.quantity! + item.quantity!) * 1000) / 1000 })
            .where(eq(items.id, target.id));
          await tx.delete(items).where(eq(items.id, item.id));
        });
        return getItemView(db, target.id);
      }
      // Ziel nicht mehr aktiv → normal wiederherstellen
    }

    const applianceId = body.applianceId ?? item.applianceId;
    if (!applianceId)
      throw new HttpError(400, "Das ursprüngliche Kühlgerät existiert nicht mehr – bitte ein Gerät wählen");
    await getOwnedAppliance(db, user.householdId, applianceId);

    let compartmentId = body.compartmentId !== undefined ? body.compartmentId : item.compartmentId;
    if (compartmentId) {
      const [c] = await db
        .select({ applianceId: compartments.applianceId })
        .from(compartments)
        .where(eq(compartments.id, compartmentId));
      if (!c || c.applianceId !== applianceId) {
        if (body.compartmentId) throw new HttpError(400, "Fach gehört nicht zu diesem Kühlgerät");
        compartmentId = null;
      }
    }

    // Alter Rasterplatz noch frei? Sonst ohne Platz zurücklegen.
    let placement: Record<string, number | null> = NO_PLACEMENT;
    if (compartmentId && compartmentId === item.compartmentId && item.gridX != null && item.gridY != null) {
      const comp = await getOwnedCompartment(db, user.householdId, compartmentId);
      const rect = { x: item.gridX, y: item.gridY, w: item.gridW ?? 1, h: item.gridH ?? 1 };
      const level = levelFor(rect, await loadPlaced(db, compartmentId));
      if (inBounds(rect, comp) && level < comp.maxStack) placement = { gridX: rect.x, gridY: rect.y, gridW: rect.w, gridH: rect.h, stackLevel: level };
    }

    await db
      .update(items)
      .set({ status: "active", removalReason: null, removedAt: null, applianceId, compartmentId, ...placement })
      .where(eq(items.id, id));
    return getItemView(db, id);
  });

  /* ---------------- Platzieren im Raster (erweiterter Modus) ---------------- */
  app.patch("/api/items/:id/placement", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    const body = z
      .union([
        z.object({ unplace: z.literal(true) }),
        z.object({ compartmentId: z.uuid(), ...placementFields }),
      ])
      .parse(req.body);
    const item = await getOwnedItem(db, user.householdId, id);
    if (item.status !== "active") throw new HttpError(409, "Nur Artikel im Kühlgerät können platziert werden");

    if ("unplace" in body) {
      await db.update(items).set(NO_PLACEMENT).where(eq(items.id, id));
      await normalizeCompartment(db, item.compartmentId);
      return getItemView(db, id);
    }

    const comp = await getOwnedCompartment(db, user.householdId, body.compartmentId);
    const rect = { x: body.gridX, y: body.gridY, w: body.gridW, h: body.gridH };
    const level = await resolvePlacement(db, comp, rect, id);
    await db
      .update(items)
      .set({
        applianceId: comp.applianceId,
        compartmentId: comp.id,
        gridX: rect.x,
        gridY: rect.y,
        gridW: rect.w,
        gridH: rect.h,
        stackLevel: level,
      })
      .where(eq(items.id, id));
    if (item.compartmentId !== comp.id) await normalizeCompartment(db, item.compartmentId);
    await normalizeCompartment(db, comp.id);
    return getItemView(db, id);
  });

  /* ---------------- Endgültig löschen (nur aus dem Archiv) ---------------- */
  app.delete("/api/items/:id", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    const item = await getOwnedItem(db, user.householdId, id);
    if (item.status !== "archived")
      throw new HttpError(409, "Nur Artikel im Archiv können endgültig gelöscht werden");
    await db.delete(items).where(eq(items.id, id));
    await deletePhotoIfUnused(db, item.photoId);
    return { ok: true };
  });
}
