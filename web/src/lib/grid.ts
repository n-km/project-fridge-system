import type { Compartment, Item } from "../types";

/*
 * Raster-Logik im Browser – identisch zu server/src/grid.ts.
 * Dient der Vorschau beim Ziehen; der Server prüft beim Speichern erneut.
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type Placed = Rect & { id: string; level: number };

export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const inBounds = (r: Rect, c: Pick<Compartment, "gridCols" | "gridRows">) =>
  r.x >= 0 && r.y >= 0 && r.w >= 1 && r.h >= 1 && r.x + r.w <= c.gridCols && r.y + r.h <= c.gridRows;

export function levelFor(rect: Rect, placed: Placed[], excludeId?: string) {
  let level = 0;
  for (const p of placed) if (p.id !== excludeId && overlaps(rect, p)) level = Math.max(level, p.level + 1);
  return level;
}

export function findFree(c: Compartment, placed: Placed[], w: number, h: number, excludeId?: string) {
  const others = placed.filter((p) => p.id !== excludeId);
  w = Math.min(Math.max(1, w), c.gridCols);
  h = Math.min(Math.max(1, h), c.gridRows);
  for (let target = 0; target < c.maxStack; target++)
    for (let y = 0; y + h <= c.gridRows; y++)
      for (let x = 0; x + w <= c.gridCols; x++) if (levelFor({ x, y, w, h }, others) === target) return { x, y, w, h, level: target };
  return null;
}

/** Platzierte Artikel eines Fachs, unten zuerst. */
export function placedIn(items: Item[], compartmentId: string): (Placed & { item: Item })[] {
  return items
    .filter((i) => i.compartmentId === compartmentId && i.gridX != null && i.gridY != null)
    .map((i) => ({ id: i.id, x: i.gridX!, y: i.gridY!, w: i.gridW ?? 1, h: i.gridH ?? 1, level: i.stackLevel ?? 0, item: i }))
    .sort((a, b) => a.level - b.level);
}

export type Verdict = { ok: true; level: number } | { ok: false; reason: string };

export function checkSpot(c: Compartment, placed: Placed[], rect: Rect, excludeId?: string): Verdict {
  if (!inBounds(rect, c)) return { ok: false, reason: "Passt nicht ins Fach" };
  const level = levelFor(rect, placed, excludeId);
  if (level >= c.maxStack) return { ok: false, reason: `Höchstens ${c.maxStack} übereinander` };
  return { ok: true, level };
}

export const SIZE_PRESETS: { w: number; h: number; label: string }[] = [
  { w: 1, h: 1, label: "1×1" },
  { w: 2, h: 1, label: "2×1" },
  { w: 1, h: 2, label: "1×2" },
  { w: 2, h: 2, label: "2×2" },
  { w: 3, h: 1, label: "3×1" },
  { w: 3, h: 2, label: "3×2" },
  { w: 3, h: 3, label: "3×3" },
];
