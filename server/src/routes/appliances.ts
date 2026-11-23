import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth.js";
import { config } from "../config.js";
import type { Db } from "../db/index.js";
import { appliances, compartments, items } from "../db/schema.js";
import { HttpError, notFound } from "../http.js";

const DEFAULT_COMPARTMENTS = {
  fridge: ["Oberes Fach", "Mittleres Fach", "Unteres Fach", "Gemüsefach", "Tür"],
  freezer: ["Schublade 1", "Schublade 2", "Schublade 3"],
} as const;

const applianceBody = z.object({
  name: z.string().trim().min(1).max(60),
  location: z.string().trim().max(80).nullish(),
  type: z.enum(["fridge", "freezer"]),
  color: z.string().trim().max(20).nullish(),
  sortOrder: z.number().int().optional(),
  compartments: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
});

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
        expiringSoon: sql<number>`count(*) filter (where ${items.bestBefore} >= current_date and ${items.bestBefore} <= current_date + ${config.expiringSoonDays}::int)::int`,
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
    const created = await db.transaction(async (tx) => {
      const [a] = await tx
        .insert(appliances)
        .values({
          householdId: user.householdId,
          name: body.name,
          location: body.location ?? null,
          type: body.type,
          color: body.color ?? null,
          sortOrder: body.sortOrder ?? 0,
        })
        .returning();
      const names = body.compartments ?? DEFAULT_COMPARTMENTS[body.type];
      if (names.length > 0) {
        await tx.insert(compartments).values(
          names.map((name, i) => ({ applianceId: a!.id, name, sortOrder: i })),
        );
      }
      return a!;
    });
    return reply.status(201).send(created);
  });

  app.patch("/api/appliances/:id", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    const body = applianceBody.omit({ compartments: true }).partial().parse(req.body);
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
    const body = z
      .object({ name: z.string().trim().min(1).max(40), sortOrder: z.number().int().optional() })
      .parse(req.body);
    await getOwnedAppliance(db, user.householdId, id);
    const [max] = await db
      .select({ m: sql<number>`coalesce(max(${compartments.sortOrder}), -1)::int` })
      .from(compartments)
      .where(eq(compartments.applianceId, id));
    const [c] = await db
      .insert(compartments)
      .values({ applianceId: id, name: body.name, sortOrder: body.sortOrder ?? (max?.m ?? -1) + 1 })
      .returning();
    return reply.status(201).send(c);
  });

  app.patch("/api/compartments/:id", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    const body = z
      .object({ name: z.string().trim().min(1).max(40), sortOrder: z.number().int() })
      .partial()
      .parse(req.body);
    await getOwnedCompartment(db, user.householdId, id);
    const [c] = await db.update(compartments).set(body).where(eq(compartments.id, id)).returning();
    return c;
  });

  app.delete("/api/compartments/:id", async (req) => {
    const user = requireUser(req);
    const { id } = idParam.parse(req.params);
    await getOwnedCompartment(db, user.householdId, id);
    // Artikel bleiben im Gerät, verlieren nur die Fach-Zuordnung (FK: set null)
    await db.delete(compartments).where(eq(compartments.id, id));
    return { ok: true };
  });
}
