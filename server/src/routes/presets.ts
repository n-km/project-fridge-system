import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth.js";
import { CATEGORY_IDS } from "../categories.js";
import type { Db } from "../db/index.js";
import { presets } from "../db/schema.js";
import { HttpError, notFound } from "../http.js";
import { assertOwnedPhoto, deletePhotoIfUnused } from "../photos.js";

const days = z.number().int().min(0).max(3650).nullish();

const presetBody = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.enum(CATEGORY_IDS).default("other"),
  icon: z.string().trim().max(16).nullish(),
  defaultQuantity: z.number().positive().max(1_000_000).nullish(),
  defaultUnit: z.string().trim().max(20).nullish(),
  shelfLifeFridgeDays: days,
  shelfLifeFreezerDays: days,
  barcode: z.string().trim().max(64).nullish(),
  photoId: z.uuid().nullish(),
});

export async function presetRoutes(app: FastifyInstance, db: Db) {
  /** Globale + eigene Presets. ?q= filtert nach Namen. */
  app.get("/api/presets", async (req) => {
    const user = requireUser(req);
    const { q } = z.object({ q: z.string().trim().max(80).optional() }).parse(req.query);
    const scope = or(isNull(presets.householdId), eq(presets.householdId, user.householdId));
    const rows = await db
      .select()
      .from(presets)
      .where(q ? and(scope, ilike(presets.name, `%${q.replace(/[%_]/g, "\\$&")}%`)) : scope)
      .orderBy(asc(presets.name));
    return rows.map(({ householdId, ...p }) => ({ ...p, global: householdId === null }));
  });

  app.post("/api/presets", async (req, reply) => {
    const user = requireUser(req);
    const body = presetBody.parse(req.body);
    if (body.photoId) await assertOwnedPhoto(db, user.householdId, body.photoId);
    const [p] = await db
      .insert(presets)
      .values({ ...body, householdId: user.householdId })
      .returning();
    return reply.status(201).send({ ...p, global: false });
  });

  const getOwnPreset = async (householdId: string, id: string) => {
    const [p] = await db.select().from(presets).where(eq(presets.id, id));
    if (!p) throw notFound("Preset");
    if (p.householdId === null)
      throw new HttpError(403, "Globale Presets können nicht geändert werden – lege eine eigene Kopie an");
    if (p.householdId !== householdId) throw notFound("Preset");
    return p;
  };

  app.patch("/api/presets/:id", async (req) => {
    const user = requireUser(req);
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const body = presetBody.partial().parse(req.body);
    const old = await getOwnPreset(user.householdId, id);
    if (body.photoId) await assertOwnedPhoto(db, user.householdId, body.photoId);
    const [p] = await db.update(presets).set(body).where(eq(presets.id, id)).returning();
    if (body.photoId !== undefined && old.photoId !== body.photoId)
      await deletePhotoIfUnused(db, old.photoId);
    return { ...p, global: false };
  });

  app.delete("/api/presets/:id", async (req) => {
    const user = requireUser(req);
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const old = await getOwnPreset(user.householdId, id);
    await db.delete(presets).where(eq(presets.id, id));
    await deletePhotoIfUnused(db, old.photoId);
    return { ok: true };
  });
}
