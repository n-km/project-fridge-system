import { Grid2x2Check, Wand2, X } from "lucide-react";
import { useState } from "react";
import { placeItem, useItems, useUserSettings } from "../../api";
import { checkSpot, findFree, placedIn, SIZE_PRESETS, type Rect } from "../../lib/grid";
import type { Compartment, Item } from "../../types";
import { ErrorNote } from "../common";
import { Surface, type TileOptions } from "./Surface";

const PICKER_CELL = 34;

function useTileOpts(): TileOptions {
  const s = useUserSettings().data?.extended;
  return { tileStyle: s?.tileStyle === "photo" ? "icon" : (s?.tileStyle ?? "icon"), showNames: false, showExpiry: s?.showExpiry ?? true };
}

/** Größenwahl als Chips (nur Größen, die ins Fach passen). */
export function SizeChips({ compartment, w, h, onChange }: { compartment: Compartment; w: number; h: number; onChange: (w: number, h: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Größe im Raster">
      {SIZE_PRESETS.filter((s) => s.w <= compartment.gridCols && s.h <= compartment.gridRows).map((s) => (
        <button key={s.label} type="button" className="chip min-h-8 px-2.5" aria-pressed={s.w === w && s.h === h} onClick={() => onChange(s.w, s.h)}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Platz im Fach beim Einlegen wählen:
 * „auto“ = Server sucht freien Platz, null = nicht platzieren, {x,y} = fester Platz.
 */
export type PlacementChoice = "auto" | null | { x: number; y: number };

export function PlacementField({
  compartment,
  size,
  onSize,
  value,
  onChange,
}: {
  compartment: Compartment;
  size: { w: number; h: number };
  onSize: (w: number, h: number) => void;
  value: PlacementChoice;
  onChange: (v: PlacementChoice) => void;
}) {
  const items = useItems({ compartmentId: compartment.id, limit: "500" });
  const opts = useTileOpts();
  const placed = placedIn(items.data ?? [], compartment.id);
  const auto = findFree(compartment, placed, size.w, size.h);
  const rect: Rect | null =
    value === "auto" ? (auto ? { x: auto.x, y: auto.y, w: auto.w, h: auto.h } : null) : value ? { ...value, w: size.w, h: size.h } : null;
  const verdict = rect ? checkSpot(compartment, placed, rect) : null;
  const cell = Math.min(PICKER_CELL, Math.floor(300 / compartment.gridCols));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="chip" aria-pressed={value === "auto"} onClick={() => onChange("auto")}>
          <Wand2 className="size-4" /> Automatisch
        </button>
        <button type="button" className="chip" aria-pressed={value !== "auto" && value !== null} onClick={() => onChange(auto ? { x: auto.x, y: auto.y } : { x: 0, y: 0 })}>
          <Grid2x2Check className="size-4" /> Selbst wählen
        </button>
        <button type="button" className="chip" aria-pressed={value === null} onClick={() => onChange(null)}>
          <X className="size-4" /> Später
        </button>
      </div>
      {value !== null && (
        <>
          <SizeChips compartment={compartment} w={size.w} h={size.h} onChange={onSize} />
          <div className="overflow-x-auto pb-1">
            <Surface
              compartment={compartment}
              placed={placed}
              cell={cell}
              opts={opts}
              selection={rect}
              onCellClick={(x, y) => onChange({ x: Math.min(x, compartment.gridCols - size.w), y: Math.min(y, compartment.gridRows - size.h) })}
            />
          </div>
          <p className="text-sm text-ink-soft">
            {value === "auto" && !auto
              ? "Für diese Größe ist kein Platz mehr frei – der Artikel wird ohne Platz eingelegt."
              : verdict && !verdict.ok
                ? verdict.reason
                : verdict?.ok && verdict.level > 0
                  ? `Wird gestapelt (Ebene ${verdict.level + 1}).`
                  : "Tippe auf ein Feld, um den Platz zu wählen. Vorne ist unten."}
          </p>
        </>
      )}
    </div>
  );
}

/** Platz eines vorhandenen Artikels ändern (im Artikel-Sheet). */
export function PlacementEditor({ item, compartment }: { item: Item; compartment: Compartment }) {
  const items = useItems({ compartmentId: compartment.id, limit: "500" });
  const opts = useTileOpts();
  const placed = placedIn(items.data ?? [], compartment.id);
  const [size, setSize] = useState({ w: item.gridW ?? 1, h: item.gridH ?? 1 });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const cell = Math.min(PICKER_CELL, Math.floor(300 / compartment.gridCols));
  const isPlaced = item.gridX != null;

  async function place(x: number, y: number, w = size.w, h = size.h) {
    setBusy(true);
    setError(null);
    try {
      await placeItem(item.id, { compartmentId: compartment.id, gridX: x, gridY: y, gridW: w, gridH: h });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <SizeChips
        compartment={compartment}
        w={size.w}
        h={size.h}
        onChange={(w, h) => {
          setSize({ w, h });
          if (isPlaced) void place(Math.min(item.gridX!, compartment.gridCols - w), Math.min(item.gridY!, compartment.gridRows - h), w, h);
        }}
      />
      <div className="overflow-x-auto pb-1" aria-busy={busy}>
        <Surface
          compartment={compartment}
          placed={placed}
          cell={cell}
          opts={opts}
          selection={isPlaced ? { x: item.gridX!, y: item.gridY!, w: item.gridW ?? 1, h: item.gridH ?? 1 } : null}
          onCellClick={(x, y) => place(Math.min(x, compartment.gridCols - size.w), Math.min(y, compartment.gridRows - size.h))}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {!isPlaced && (
          <button
            type="button"
            className="btn-quiet min-h-9 text-sm"
            disabled={busy}
            onClick={() => {
              const free = findFree(compartment, placed, size.w, size.h, item.id);
              if (free) void place(free.x, free.y, free.w, free.h);
              else setError(new Error("Für diese Größe ist kein Platz mehr frei."));
            }}
          >
            <Wand2 className="size-4" /> Automatisch platzieren
          </button>
        )}
        {isPlaced && (
          <button type="button" className="btn-quiet min-h-9 text-sm" disabled={busy} onClick={() => placeItem(item.id, { unplace: true }).catch(setError)}>
            <X className="size-4" /> Aus dem Raster nehmen
          </button>
        )}
      </div>
      <p className="text-sm text-ink-soft">{isPlaced ? "Feld antippen, um den Artikel dorthin zu legen." : "Noch kein Platz – Feld antippen oder automatisch platzieren."}</p>
      <ErrorNote error={error} />
    </div>
  );
}
