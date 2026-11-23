import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth.js";
import { APPLIANCE_TEMPLATES, COMPARTMENT_KINDS, type CompartmentSpec } from "../categories.js";
import { findFree, loadPlaced, normalizeCompartment } from "../grid.js";
import { getHouseholdSettings } from "../settings.js";
import type { Db } from "../db/index.js";
import { appliances, compartments, items } from "../db/schema.js";
import { HttpError, notFound } from "../http.js";

const KIND_IDS = COMPARTMENT_KINDS.map((k) => k.id) as [CompartmentSpec["kind"], ...CompartmentSpec["kind"][]];

/** Eigenschaften eines Fachs (Raster, Art, Zone). */
const compartmentFields = {
  name: z.string().trim().min(1).max(40),
  kind: z.enum(KIND_IDS),
  zone: z.enum(["fridge", "freezer"]).nullable(),
  gridCols: z.number().int().min(1).max(12),
  gridRows: z.number().int().min(1).max(8),
  maxStack: z.number().int().min(1).max(6),
  height: z.number().int().min(1).max(4),
  sortOrder: z.number().int(),
};
const compartmentCreate = z.object(compartmentFields).partial().required({ name: true });

const applianceBody = z.object({
  name: z.string().trim().min(1).max(60),
  location: z.string().trim().max(80).nullish(),
  type: z.enum(["fridge", "freezer"]).optional(),
  layout: z.enum(["upright", "chest"]).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish(),
  sortOrder: z.number().int().optional(),
  /** Vorlage für Bauform und Fächer (siehe GET /api/meta). */
  template: z.string().max(40).optional(),
  /** Eigene Fächer: nur Namen (wie in 1.0) oder vollständige Angaben. */
  compartments: z.array(z.union([z.string().trim().min(1).max(40), compartmentCreate])).max(30).optional(),
});

function specFromInput(c: string | z.infer<typeof compartmentCreate>, fallbackKind: CompartmentSpec["kind"] = "shelf"): CompartmentSpec {
  if (typeof c === "string") return { name: c, kind: fallbackKind, gridCols: 6, gridRows: 3, maxStack: 2, height: 2 };
  return {
    name: c.name,
    kind: c.kind ?? fallbackKind,
    zone: c.zone ?? null,
    gridCols: c.gridCols ?? 6,
    gridRows: c.gridRows ?? 3,
    maxStack: c.maxStack ?? 2,
    height: c.height ?? 2,
  };
}

const idParam = z.object({ id: z.uuid() });

export async function getOwnedAppliance(db: Db, householdId: string, id: string) {
  const [a] = await db
    .select()
    .from(appliances)
    .where(and(eq(appliances.id, id), eq(appliances.householdId, householdId)));
  if (!a) throw notFound("Kühlgerät");
  return a;
}

export async function getOwnedCompartment(db: Db, householdId: string, id: string) {
  const [c] = await db
    .select({ c: compartments, householdId: appliances.householdId })
    .from(compartments)
    .innerJoin(appliances, eq(appliances.id, compartments.applianceId))
    .where(and(eq(compartments.id, id), eq(appliances.householdId, householdId)));
  if (!c) throw notFound("Fach");
  return c.c;
}

export async function applianceRoutes(app: FastifyInstance, db: Db) {
  /** Alle Geräte inkl. Fächer und Zählern für das Dashboard. */
  app.get("/api/appliances", async (req) => {
    const user = requireUser(req);
    const { expiringSoonDays } = await getHouseholdSettings(db, user.householdId);
    const list = await db
      .select()
      .from(appliances)
      .where(eq(appliances.householdId, user.householdId))
      .orderBy(asc(appliances.sortOrder), asc(appliances.createdAt));
    if (list.length === 0) return [];

    const ids = list.map((a) => a.id);
    const comps = await db
      .select()
      .from(compartments)
      .where(inArray(compartments.applianceId, ids))
      .orderBy(asc(compartments.sortOrder), asc(compartments.name));

    const counts = await db
      .select({
        applianceId: items.applianceId,
        active: sql<number>`count(*)::int`,
        expired: sql<number>`count(*) filter (where ${items.bestBefore} < current_date)::int`,
        expiringSoon: sql<number>`count(*) filter (where ${items.bestBefore} >= current_date and ${items.bestBefore} <= current_date + ${expiringSoonDays}::int)::int`,
      })
      .from(items)
      .where(and(eq(items.householdId, user.householdId), eq(items.status, "active")))
      .groupBy(items.applianceId);
    const countMap = new Map(counts.map((c) => [c.applianceId, c]));

    return list.map((a) => ({
      ...a,
      compartments: comps.filter((c) => c.applianceId === a.id),
      counts: {
        active: countMap.get(a.id)?.active ?? 0,
        expired: countMap.get(a.id)?.expired ?? 0,
        expiringSoon: countMap.get(a.id)?.expiringSoon ?? 0,
      },
    }));
  });

  app.get("/api/appliances/:id", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    const a = await getOwnedAppliance(db, user.householdId, id);
    const comps = await db
      .select()
      .from(compartments)
      .where(eq(compartments.applianceId, id))
      .orderBy(asc(compartments.sortOrder), asc(compartments.name));
    return { ...a, compartments: comps };
  });

  app.post("/api/appliances", async (req, reply) => {
    const user = requireUser(req);
    const body = applianceBody.parse(req.body);
    const template =
      APPLIANCE_TEMPLATES.find((t) => t.id === body.template) ??
      APPLIANCE_TEMPLATES.find((t) => t.id === (body.type === "freezer" ? "freezer" : "fridge"))!;
    if (body.template && template.id !== body.template) throw new HttpError(400, "Unbekannte Vorlage");
    const type = body.type ?? template.type;
    const specs = body.compartments
      ? body.compartments.map((c) => specFromInput(c, type === "freezer" ? "drawer" : "shelf"))
      : template.compartments;
    const created = await db.transaction(async (tx) => {
      const [a] = await tx
        .insert(appliances)
        .values({
          householdId: user.householdId,
          name: body.name,
          location: body.location ?? null,
          type,
          layout: body.layout ?? template.layout,
          color: body.color ?? null,
          sortOrder: body.sortOrder ?? 0,
        })
        .returning();
      if (specs.length > 0) {
        await tx.insert(compartments).values(
          specs.map((c, i) => ({ applianceId: a!.id, sortOrder: i, ...c, zone: c.zone ?? null })),
        );
      }
      return a!;
    });
    return reply.status(201).send(created);
  });

  app.patch("/api/appliances/:id", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    const body = applianceBody.omit({ compartments: true, template: true }).partial().parse(req.body);
    await getOwnedAppliance(db, user.householdId, id);
    const [a] = await db
      .update(appliances)
      .set(body)
      .where(eq(appliances.id, id))
      .returning();
    return a;
  });

  app.delete("/api/appliances/:id", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    await getOwnedAppliance(db, user.householdId, id);
    const [{ n }] = (await db
      .select({ n: sql<number>`count(*)::int` })
      .from(items)
      .where(and(eq(items.applianceId, id), eq(items.status, "active")))) as [{ n: number }];
    if (n > 0)
      throw new HttpError(409, `Im Gerät liegen noch ${n} Artikel – bitte zuerst entnehmen oder umlagern`);
    await db.delete(appliances).where(eq(appliances.id, id));
    return { ok: true };
  });

  /* ---------------- Fächer ---------------- */

  app.post("/api/appliances/:id/compartments", async (req, reply) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    const body = compartmentCreate.parse(req.body);
    const appliance = await getOwnedAppliance(db, user.householdId, id);
    const [max] = await db
      .select({ m: sql<number>`coalesce(max(${compartments.sortOrder}), -1)::int` })
      .from(compartments)
      .where(eq(compartments.applianceId, id));
    const [c] = await db
      .insert(compartments)
      .values({
        applianceId: id,
        ...specFromInput(body, appliance.type === "freezer" ? "drawer" : "shelf"),
        sortOrder: body.sortOrder ?? (max?.m ?? -1) + 1,
      })
      .returning();
    return reply.status(201).send(c);
  });

  app.patch("/api/compartments/:id", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    const body = z.object(compartmentFields).partial().parse(req.body);
    await getOwnedCompartment(db, user.householdId, id);
    const [c] = await db.update(compartments).set(body).where(eq(compartments.id, id)).returning();
    // Raster verkleinert? Artikel außerhalb werden aus dem Raster genommen, Stapel neu geordnet
    await normalizeCompartment(db, id);
    return c;
  });

  /** Reihenfolge der Fächer festlegen. */
  app.put("/api/appliances/:id/compartments/order", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    const { ids } = z.object({ ids: z.array(z.uuid()).max(50) }).parse(req.body);
    await getOwnedAppliance(db, user.householdId, id);
    const own = await db.select({ id: compartments.id }).from(compartments).where(eq(compartments.applianceId, id));
    const ownIds = new Set(own.map((c) => c.id));
    if (ids.length !== ownIds.size || ids.some((x) => !ownIds.has(x)))
      throw new HttpError(400, "Liste muss alle Fächer des Geräts genau einmal enthalten");
    await db.transaction(async (tx) => {
      for (const [i, cid] of ids.entries()) await tx.update(compartments).set({ sortOrder: i }).where(eq(compartments.id, cid));
    });
    return { ok: true };
  });

  /** „Wo ist noch Platz?“ – erster freier Platz für ein w × h großes Objekt. */
  app.get("/api/compartments/:id/free", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    const { w, h } = z
      .object({ w: z.coerce.number().int().min(1).max(12).default(1), h: z.coerce.number().int().min(1).max(8).default(1) })
      .parse(req.query);
    const c = await getOwnedCompartment(db, user.householdId, id);
    return { spot: findFree(c, await loadPlaced(db, id), w, h) };
  });

  app.delete("/api/compartments/:id", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    await getOwnedCompartment(db, user.householdId, id);
    // Artikel bleiben im Gerät, verlieren nur die Fach-Zuordnung (FK: set null) und den Rasterplatz
    await db
      .update(items)
      .set({ gridX: null, gridY: null, gridW: null, gridH: null, stackLevel: null })
      .where(eq(items.compartmentId, id));
    await db.delete(compartments).where(eq(compartments.id, id));
    return { ok: true };
  });
}
