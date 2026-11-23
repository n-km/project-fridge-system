import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { and, eq, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { z } from "zod";
import { requireUser } from "./auth.js";
import { config } from "./config.js";
import type { Db } from "./db/index.js";
import { items, photos, presets } from "./db/schema.js";
import { HttpError, notFound } from "./http.js";

const FULL_SIZE = 1200;
const THUMB_SIZE = 320;

/**
 * Speichert ein hochgeladenes Bild:
 *  - dreht es gemäß EXIF-Ausrichtung
 *  - verkleinert auf max. 1200 px und erzeugt ein 320-px-Vorschaubild
 *  - speichert als WebP; sharp übernimmt dabei KEINE Metadaten (EXIF/GPS wird entfernt)
 */
export async function storePhoto(
  db: Db,
  householdId: string,
  userId: string,
  input: Buffer,
) {
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new HttpError(400, "Datei ist kein gültiges Bild");
  }
  if (!meta.width || !meta.height) throw new HttpError(400, "Datei ist kein gültiges Bild");

  const base = crypto.randomUUID();
  const dir = path.join(config.uploadDir, householdId);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${base}.webp`;
  const thumbName = `${base}_thumb.webp`;

  await sharp(input)
    .rotate()
    .resize(FULL_SIZE, FULL_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(dir, fileName));
  await sharp(input)
    .rotate()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
    .webp({ quality: 75 })
    .toFile(path.join(dir, thumbName));

  const [row] = await db
    .insert(photos)
    .values({ householdId, fileName, thumbName, createdBy: userId })
    .returning({ id: photos.id });
  return row!.id;
}

export async function assertOwnedPhoto(db: Db, householdId: string, photoId: string) {
  const [p] = await db
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.householdId, householdId)));
  if (!p) throw notFound("Foto");
}

async function removePhotoFiles(householdId: string, fileName: string, thumbName: string) {
  const dir = path.join(config.uploadDir, householdId);
  await Promise.allSettled([
    fs.unlink(path.join(dir, fileName)),
    fs.unlink(path.join(dir, thumbName)),
  ]);
}

/** Löscht ein Foto (Datei + DB), wenn es von keinem Artikel/Preset mehr benutzt wird. */
export async function deletePhotoIfUnused(db: Db, photoId: string | null | undefined) {
  if (!photoId) return;
  const [usage] = await db.execute<{ n: number }>(sql`
    select
      (select count(*) from ${items} where ${items.photoId} = ${photoId})
    + (select count(*) from ${presets} where ${presets.photoId} = ${photoId}) as n`);
  if (Number(usage?.n ?? 0) > 0) return;
  const [p] = await db.delete(photos).where(eq(photos.id, photoId)).returning();
  if (p) await removePhotoFiles(p.householdId, p.fileName, p.thumbName);
}

/**
 * Entfernt Fotos, die hochgeladen, aber nie einem Artikel/Preset zugeordnet wurden
 * (z. B. Formular abgebrochen). Nur Fotos älter als 24 h.
 */
export async function cleanupOrphanPhotos(db: Db) {
  const cutoff = new Date(Date.now() - 86_400_000);
  const orphans = await db
    .select()
    .from(photos)
    .where(
      and(
        lt(photos.createdAt, cutoff),
        sql`not exists (select 1 from ${items} where ${items.photoId} = ${photos.id})`,
        sql`not exists (select 1 from ${presets} where ${presets.photoId} = ${photos.id})`,
      ),
    );
  for (const p of orphans) {
    await db.delete(photos).where(eq(photos.id, p.id));
    await removePhotoFiles(p.householdId, p.fileName, p.thumbName);
  }
  return orphans.length;
}

export async function photoRoutes(app: FastifyInstance, db: Db) {
  app.post("/api/photos", async (req, reply) => {
    const user = requireUser(req);
    const file = await req.file();
    if (!file) throw new HttpError(400, "Keine Datei übermittelt");
    if (!file.mimetype.startsWith("image/"))
      throw new HttpError(400, "Nur Bilddateien erlaubt");
    const buffer = await file.toBuffer();
    const id = await storePhoto(db, user.householdId, user.id, buffer);
    return reply.status(201).send({ id });
  });

  app.get("/api/photos/:id", async (req, reply) => {
    const user = requireUser(req);
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const { size } = z
      .object({ size: z.enum(["full", "thumb"]).default("full") })
      .parse(req.query);
    const [p] = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, id), eq(photos.householdId, user.householdId)));
    if (!p) throw notFound("Foto");
    const file = path.join(
      config.uploadDir,
      p.householdId,
      size === "thumb" ? p.thumbName : p.fileName,
    );
    let data: Buffer;
    try {
      data = await fs.readFile(file);
    } catch {
      throw notFound("Fotodatei");
    }
    return reply
      .header("Content-Type", "image/webp")
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .send(data);
  });
}
