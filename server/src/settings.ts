import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "./auth.js";
import { CATEGORIES } from "./categories.js";
import { config } from "./config.js";
import type { Db } from "./db/index.js";
import { householdSettings, userSettings } from "./db/schema.js";
import { HttpError } from "./http.js";

/*
 * Einstellungen werden als JSON gespeichert. Jedes Feld hat einen Standardwert;
 * fehlende oder ungültige Werte werden beim Lesen durch den Standard ersetzt.
 * Neue Einstellungen: einfach hier ergänzen – keine Migration nötig.
 */

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Farbe als #RRGGBB");

/* ---------------- Haushalt ---------------- */

export const customCategory = z.object({
  id: z.string().regex(/^c_[a-z0-9]{6,16}$/),
  label: z.string().trim().min(1).max(40),
  icon: z.string().trim().min(1).max(16),
  color: hexColor,
});

export const householdSettingsSchema = z.object({
  /** Ab wie vielen Tagen vor dem MHD ein Artikel „bald fällig“ ist. */
  expiringSoonDays: z.number().int().min(0).max(30).catch(config.expiringSoonDays),
  /** Eigene Kategorien zusätzlich zu den Standardkategorien. */
  customCategories: z.array(customCategory).max(50).catch([]),
  /** Ausgeblendete Standardkategorien (IDs). */
  hiddenCategories: z.array(z.string().max(40)).max(50).catch([]),
  /** Abweichende Farben/Symbole für Standardkategorien. */
  categoryOverrides: z
    .record(z.string().max(40), z.object({ icon: z.string().max(16).optional(), color: hexColor.optional() }))
    .catch({}),
  /** Zusätzliche Einheiten für die Auswahl. */
  extraUnits: z.array(z.string().trim().min(1).max(20)).max(30).catch([]),
});
export type HouseholdSettings = z.infer<typeof householdSettingsSchema>;

/* ---------------- Benutzer ---------------- */

export const HOME_SECTIONS = ["due", "appliances", "recent", "stats"] as const;

export const userSettingsSchema = z.object({
  /** Standard = Listen; Erweitert = zusätzlich 2,5D-Ansicht der Kühlgeräte. */
  mode: z.enum(["standard", "extended"]).catch("standard"),
  theme: z.enum(["auto", "light", "dark"]).catch("auto"),
  density: z.enum(["comfortable", "compact"]).catch("comfortable"),
  /** Bewegung: auto = Systemeinstellung, reduced = immer reduziert. */
  motion: z.enum(["auto", "reduced"]).catch("auto"),
  /** Artikel mit Foto oder immer mit Symbol anzeigen. */
  itemDisplay: z.enum(["photo", "icon"]).catch("photo"),
  /** Wischgesten auf Touch-Geräten. */
  swipe: z.boolean().catch(true),
  /** Bereiche der Startseite in Reihenfolge. */
  home: z
    .array(z.object({ id: z.enum(HOME_SECTIONS), visible: z.boolean() }))
    .max(10)
    .catch(HOME_SECTIONS.map((id) => ({ id, visible: id !== "stats" }))),
  defaultApplianceId: z.uuid().nullable().catch(null),
  /** Optionen für den erweiterten Modus. */
  extended: z
    .object({
      /** Stärke der Perspektive. */
      perspective: z.enum(["flat", "subtle", "strong"]).catch("subtle"),
      /** Darstellung der Artikel im Raster. */
      tileStyle: z.enum(["photo", "icon", "block"]).catch("photo"),
      /** Größe einer Rasterzelle. */
      cellSize: z.enum(["S", "M", "L"]).catch("M"),
      /** Namen auf den Kacheln anzeigen. */
      showNames: z.boolean().catch(true),
      /** Ampel-Markierung im Gerät. */
      showExpiry: z.boolean().catch(true),
      /** Beim Öffnen des Geräts zuerst die 2,5D-Ansicht zeigen. */
      openIn3d: z.boolean().catch(true),
    })
    .catch({
      perspective: "subtle",
      tileStyle: "photo",
      cellSize: "M",
      showNames: true,
      showExpiry: true,
      openIn3d: true,
    }),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

/** Liest gespeicherte Daten und füllt Standardwerte auf. */
function parseWithDefaults<T extends z.ZodObject>(schema: T, data: unknown): z.infer<T> {
  const obj = data && typeof data === "object" ? data : {};
  // .catch() an jedem Feld sorgt dafür, dass fehlende/ungültige Felder den Standard bekommen
  return schema.parse(obj);
}

export async function getHouseholdSettings(db: Db, householdId: string): Promise<HouseholdSettings> {
  const [row] = await db.select().from(householdSettings).where(eq(householdSettings.householdId, householdId));
  return parseWithDefaults(householdSettingsSchema, row?.data);
}

export async function getUserSettings(db: Db, userId: string): Promise<UserSettings> {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  return parseWithDefaults(userSettingsSchema, row?.data);
}

/** Alle gültigen Kategorie-IDs eines Haushalts (Standard + eigene). */
export async function allowedCategoryIds(db: Db, householdId: string) {
  const s = await getHouseholdSettings(db, householdId);
  return new Set<string>([...CATEGORIES.map((c) => c.id), ...s.customCategories.map((c) => c.id)]);
}

export async function assertCategory(db: Db, householdId: string, category: string | undefined) {
  if (category === undefined) return;
  if (!(await allowedCategoryIds(db, householdId)).has(category))
    throw new HttpError(400, `Unbekannte Kategorie „${category}“`);
}

/**
 * Teil-Update: Für jedes übergebene Feld wird das alte durch das neue ersetzt;
 * Objekte (wie `extended`) werden zusammengeführt.
 */
function merge<T extends Record<string, unknown>>(current: T, patch: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" && !Array.isArray(cur)
        ? { ...(cur as object), ...(v as object) }
        : v;
  }
  return out as T;
}

export async function settingsRoutes(app: FastifyInstance, db: Db) {
  app.get("/api/settings/me", async (req) => getUserSettings(db, requireUser(req).id));

  app.patch("/api/settings/me", async (req) => {
    const user = requireUser(req);
    // Strenge Prüfung des Patches: ungültige Werte → 400 statt stillem Standardwert.
    // (Nicht erneut mit Standardwerten parsen, sonst würden Teil-Objekte andere Felder zurücksetzen.)
    const patch = strictCheck(userSettingsSchema, req.body);
    const next = merge(await getUserSettings(db, user.id), patch);
    const data = userSettingsSchema.parse(next);
    await db
      .insert(userSettings)
      .values({ userId: user.id, data })
      .onConflictDoUpdate({ target: userSettings.userId, set: { data, updatedAt: new Date() } });
    return data;
  });

  app.get("/api/settings/household", async (req) => getHouseholdSettings(db, requireUser(req).householdId));

  app.patch("/api/settings/household", async (req) => {
    const user = requireUser(req);
    const patch = strictCheck(householdSettingsSchema, req.body);
    const next = merge(await getHouseholdSettings(db, user.householdId), patch);
    const data = householdSettingsSchema.parse(next);
    await db
      .insert(householdSettings)
      .values({ householdId: user.householdId, data })
      .onConflictDoUpdate({ target: householdSettings.householdId, set: { data, updatedAt: new Date() } });
    return data;
  });

  /** Neue eigene Kategorie anlegen (ID wird vom Server vergeben). */
  app.post("/api/settings/household/categories", async (req, reply) => {
    const user = requireUser(req);
    const body = customCategory.omit({ id: true }).parse(req.body);
    const current = await getHouseholdSettings(db, user.householdId);
    const category = { id: `c_${crypto.randomBytes(5).toString("hex")}`, ...body };
    const data = householdSettingsSchema.parse({
      ...current,
      customCategories: [...current.customCategories, category],
    });
    await db
      .insert(householdSettings)
      .values({ householdId: user.householdId, data })
      .onConflictDoUpdate({ target: householdSettings.householdId, set: { data, updatedAt: new Date() } });
    return reply.status(201).send(category);
  });
}

/**
 * Prüft jedes Feld des Patches gegen das Schema OHNE die .catch()-Standardwerte,
 * damit Tippfehler beim Speichern auffallen.
 */
function strictCheck(schema: z.ZodObject, body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Ungültige Eingabe");
  const shape = schema.shape as Record<string, z.ZodType>;
  for (const [key, value] of Object.entries(body)) {
    const field = shape[key];
    if (!field) throw new HttpError(400, `Unbekannte Einstellung „${key}“`);
    const inner = field instanceof z.ZodCatch ? (field.unwrap() as z.ZodType) : field;
    const check =
      inner instanceof z.ZodObject && value && typeof value === "object"
        ? strictObject(inner, value as Record<string, unknown>, key)
        : inner.safeParse(value);
    if (!check.success) throw new HttpError(400, `Ungültiger Wert für „${key}“`);
  }
  return body as Record<string, unknown>;
}

function strictObject(schema: z.ZodObject, value: Record<string, unknown>, key: string) {
  const shape = schema.shape as Record<string, z.ZodType>;
  for (const [k, v] of Object.entries(value)) {
    const field = shape[k];
    if (!field) throw new HttpError(400, `Unbekannte Einstellung „${key}.${k}“`);
    const inner = field instanceof z.ZodCatch ? (field.unwrap() as z.ZodType) : field;
    if (!inner.safeParse(v).success) throw new HttpError(400, `Ungültiger Wert für „${key}.${k}“`);
  }
  return { success: true as const };
}
