import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { Db } from "./db/index.js";
import { compartments, items } from "./db/schema.js";

/*
 * Raster-Logik für den erweiterten Modus.
 *
 * Jedes Fach ist ein Raster aus gridCols × gridRows Zellen (Breite × Tiefe).
 * Ein Artikel belegt ein Rechteck (x, y, w, h). Überlappende Artikel werden gestapelt:
 * stackLevel 0 liegt unten, höchstens maxStack Ebenen.
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type Placed = Rect & { id: string; level: number };
export type GridSpec = { gridCols: number; gridRows: number; maxStack: number };

export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const inBounds = (r: Rect, g: GridSpec) =>
  r.x >= 0 && r.y >= 0 && r.w >= 1 && r.h >= 1 && r.x + r.w <= g.gridCols && r.y + r.h <= g.gridRows;

/** Ebene, auf der ein Rechteck landen würde (0 = Boden). */
export function levelFor(rect: Rect, placed: Placed[], excludeId?: string) {
  let level = 0;
  for (const p of placed) {
    if (p.id === excludeId) continue;
    if (overlaps(rect, p)) level = Math.max(level, p.level + 1);
  }
  return level;
}

/**
 * Sucht den ersten freien Platz: zuerst am Boden (vorne links beginnend),
 * dann gestapelt, solange maxStack nicht überschritten wird.
 */
export function findFree(g: GridSpec, placed: Placed[], w: number, h: number): (Rect & { level: number }) | null {
  w = Math.min(Math.max(1, w), g.gridCols);
  h = Math.min(Math.max(1, h), g.gridRows);
  for (let target = 0; target < g.maxStack; target++) {
    for (let y = 0; y + h <= g.gridRows; y++) {
      for (let x = 0; x + w <= g.gridCols; x++) {
        const rect = { x, y, w, h };
        if (levelFor(rect, placed) === target) return { ...rect, level: target };
      }
    }
  }
  return null;
}

/** Lädt alle aktiven, platzierten Artikel eines Fachs. */
export async function loadPlaced(db: Db, compartmentId: string): Promise<Placed[]> {
  const rows = await db
    .select({
      id: items.id,
      x: items.gridX,
      y: items.gridY,
      w: items.gridW,
      h: items.gridH,
      level: items.stackLevel,
    })
    .from(items)
    .where(and(eq(items.compartmentId, compartmentId), eq(items.status, "active"), isNotNull(items.gridX)))
    .orderBy(asc(items.stackLevel), asc(items.updatedAt));
  return rows.map((r) => ({ id: r.id, x: r.x!, y: r.y!, w: r.w ?? 1, h: r.h ?? 1, level: r.level ?? 0 }));
}

/**
 * Ordnet die Stapel eines Fachs neu, z. B. nachdem ein Artikel darunter entnommen wurde:
 * Artikel „fallen“ nach unten. Was außerhalb des Rasters liegt oder zu hoch gestapelt ist,
 * wird aus dem Raster genommen (bleibt aber im Fach).
 */
export async function normalizeCompartment(db: Db, compartmentId: string | null | undefined) {
  if (!compartmentId) return;
  const [g] = await db.select().from(compartments).where(eq(compartments.id, compartmentId));
  if (!g) return;
  const before = await loadPlaced(db, compartmentId);
  const settled: Placed[] = [];
  for (const p of before) {
    const level = inBounds(p, g) ? levelFor(p, settled) : Infinity;
    if (level >= g.maxStack) {
      await db
        .update(items)
        .set({ gridX: null, gridY: null, gridW: null, gridH: null, stackLevel: null })
        .where(eq(items.id, p.id));
      continue;
    }
    settled.push({ ...p, level });
    if (level !== p.level) await db.update(items).set({ stackLevel: level }).where(eq(items.id, p.id));
  }
}
