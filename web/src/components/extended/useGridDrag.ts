import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, placeItem } from "../../api";
import { checkSpot, placedIn } from "../../lib/grid";
import type { Compartment, Item } from "../../types";

/*
 * Ziehen & Ablegen im Raster.
 *
 * - Maus: Ziehen beginnt nach 4 px Bewegung.
 * - Touch: langes Drücken (300 ms) hebt den Artikel an; vorher scrollt die Seite normal.
 * - Ziel wird per document.elementsFromPoint gefunden (data-cell="compId:x:y").
 *   Das funktioniert auch auf perspektivisch gedrehten Flächen.
 * - Ablegen auf [data-tray] nimmt den Artikel aus dem Raster.
 */

export type DragState = {
  item: Item;
  mode: "move" | "resize";
  /** Wo innerhalb der Kachel gegriffen wurde (in Zellen) */
  grab: { dx: number; dy: number };
  w: number;
  h: number;
  pointer: { x: number; y: number };
  target:
    | { kind: "cell"; compartmentId: string; x: number; y: number; w: number; h: number; ok: boolean; level: number; reason?: string }
    | { kind: "tray" }
    | null;
};

type Opts = {
  compartments: Compartment[];
  items: Item[];
  onHoverCompartment?: (compartmentId: string) => void;
  onError: (msg: string) => void;
  onDone?: (item: Item, where: "placed" | "unplaced") => void;
};

const LONG_PRESS_MS = 300;

function hitTest(x: number, y: number) {
  for (const el of document.elementsFromPoint(x, y)) {
    const h = el as HTMLElement;
    if (h.dataset?.cell) {
      const [compartmentId, cx, cy] = h.dataset.cell.split(":");
      return { kind: "cell" as const, compartmentId: compartmentId!, x: Number(cx), y: Number(cy) };
    }
    if (h.dataset?.tray !== undefined) return { kind: "tray" as const };
    if (h.dataset?.drawer) return { kind: "drawer" as const, compartmentId: h.dataset.drawer };
  }
  return null;
}

export function useGridDrag({ compartments, items, onHoverCompartment, onError, onDone }: Opts) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pending = useRef<{ timer?: number; start: { x: number; y: number }; begin: () => void; pointerType: string } | null>(null);
  const suppressClick = useRef(false);
  const optsRef = useRef({ compartments, items, onHoverCompartment, onError, onDone });
  optsRef.current = { compartments, items, onHoverCompartment, onError, onDone };

  const update = (d: DragState | null) => {
    dragRef.current = d;
    setDrag(d);
    // Während des Ziehens keinen Text markieren
    document.body.style.userSelect = d ? "none" : "";
    document.body.style.webkitUserSelect = d ? "none" : "";
  };

  const compute = useCallback((d: DragState, px: number, py: number): DragState["target"] => {
    const hit = hitTest(px, py);
    if (!hit) return null;
    if (hit.kind === "tray") return d.item.gridX != null ? { kind: "tray" } : null;
    if (hit.kind === "drawer") {
      optsRef.current.onHoverCompartment?.(hit.compartmentId!);
      return null;
    }
    const comp = optsRef.current.compartments.find((c) => c.id === hit.compartmentId);
    if (!comp) return null;
    let rect;
    if (d.mode === "resize") {
      if (comp.id !== d.item.compartmentId || d.item.gridX == null) return null;
      rect = { x: d.item.gridX, y: d.item.gridY!, w: Math.max(1, hit.x - d.item.gridX + 1), h: Math.max(1, hit.y - d.item.gridY! + 1) };
    } else {
      const w = Math.min(d.w, comp.gridCols);
      const h = Math.min(d.h, comp.gridRows);
      rect = {
        x: Math.max(0, Math.min(hit.x - d.grab.dx, comp.gridCols - w)),
        y: Math.max(0, Math.min(hit.y - d.grab.dy, comp.gridRows - h)),
        w,
        h,
      };
    }
    const v = checkSpot(comp, placedIn(optsRef.current.items, comp.id), rect, d.item.id);
    return { kind: "cell", compartmentId: comp.id, ...rect, ok: v.ok, level: v.ok ? v.level : 0, reason: v.ok ? undefined : v.reason };
  }, []);

  // Globale Zeiger-Ereignisse während des Ziehens
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = pending.current;
      if (p && !dragRef.current) {
        const dist = Math.hypot(e.clientX - p.start.x, e.clientY - p.start.y);
        if (p.pointerType === "mouse" && dist > 4) {
          p.begin();
        } else if (p.pointerType !== "mouse" && dist > 10) {
          // Touch hat sich bewegt, bevor der lange Druck fertig war → normales Scrollen
          window.clearTimeout(p.timer);
          pending.current = null;
        }
      }
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      update({ ...d, pointer: { x: e.clientX, y: e.clientY }, target: compute(d, e.clientX, e.clientY) });
    };
    const up = async () => {
      if (pending.current) {
        window.clearTimeout(pending.current.timer);
        pending.current = null;
      }
      const d = dragRef.current;
      if (!d) return;
      update(null);
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 50);
      const t = d.target;
      try {
        if (t?.kind === "tray") {
          await placeItem(d.item.id, { unplace: true });
          optsRef.current.onDone?.(d.item, "unplaced");
        } else if (t?.kind === "cell") {
          if (!t.ok) return optsRef.current.onError(t.reason ?? "Hier ist kein Platz");
          const same =
            t.compartmentId === d.item.compartmentId && t.x === d.item.gridX && t.y === d.item.gridY && t.w === d.item.gridW && t.h === d.item.gridH;
          if (!same) {
            await placeItem(d.item.id, { compartmentId: t.compartmentId, gridX: t.x, gridY: t.y, gridW: t.w, gridH: t.h });
            optsRef.current.onDone?.(d.item, "placed");
          }
        }
      } catch (err) {
        optsRef.current.onError(err instanceof ApiError ? err.message : "Verschieben fehlgeschlagen");
      }
    };
    const cancel = () => {
      if (pending.current) window.clearTimeout(pending.current.timer);
      pending.current = null;
      update(null);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && cancel();
    // Während des Ziehens nicht scrollen (Touch)
    const touchMove = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault();
    };
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      window.removeEventListener("touchmove", touchMove);
    };
  }, [compute]);

  /** An Kachel bzw. Ablage-Element hängen. */
  const startDrag = useCallback(
    (e: React.PointerEvent, item: Item, mode: "move" | "resize", cellPx: number, defaults?: { w: number; h: number }) => {
      if (e.button !== 0) return;
      // Maus: Textauswahl schon beim Drücken verhindern (Fokus bleibt per Tastatur erreichbar)
      if (e.pointerType === "mouse") e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const grab =
        mode === "move" && item.gridX != null
          ? {
              dx: Math.min((item.gridW ?? 1) - 1, Math.floor((e.clientX - rect.left) / cellPx)),
              dy: Math.min((item.gridH ?? 1) - 1, Math.floor((e.clientY - rect.top) / cellPx)),
            }
          : { dx: 0, dy: 0 };
      const start = { x: e.clientX, y: e.clientY };
      const begin = () => {
        pending.current = null;
        if (navigator.vibrate && e.pointerType === "touch") navigator.vibrate(10);
        const d: DragState = {
          item,
          mode,
          grab,
          w: item.gridW ?? defaults?.w ?? 1,
          h: item.gridH ?? defaults?.h ?? 1,
          pointer: start,
          target: null,
        };
        update({ ...d, target: compute(d, start.x, start.y) });
      };
      pending.current = { start, begin, pointerType: e.pointerType };
      if (e.pointerType !== "mouse") pending.current.timer = window.setTimeout(begin, LONG_PRESS_MS);
    },
    [compute],
  );

  /** Nach dem Ablegen kein „Klick“ auslösen (würde sonst Details öffnen). */
  const consumeClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return true;
    }
    return false;
  };

  return { drag, startDrag, consumeClick };
}
