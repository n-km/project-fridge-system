import { AlertTriangle, Clock } from "lucide-react";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { photoUrl } from "../../api";
import type { Placed, Rect } from "../../lib/grid";
import type { Compartment, Item, UserSettings } from "../../types";
import { useCategoryInfo, useExpiry } from "../common";

export type TileOptions = Pick<UserSettings["extended"], "tileStyle" | "showNames" | "showExpiry">;

/* ---------------- Kachel ---------------- */

export function Tile({
  item,
  cell,
  opts,
  dimmed,
  highlighted,
  dragging,
  onPointerDown,
  onClick,
  onKeyDown,
  resizeHandle,
}: {
  item: Item;
  cell: number;
  opts: TileOptions;
  dimmed?: boolean;
  highlighted?: boolean;
  dragging?: boolean;
  onPointerDown?: (e: React.PointerEvent, mode: "move" | "resize") => void;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  resizeHandle?: boolean;
}) {
  const cat = useCategoryInfo()(item.category);
  const state = useExpiry()(item.bestBefore);
  const w = item.gridW ?? 1;
  const h = item.gridH ?? 1;
  const level = item.stackLevel ?? 0;
  const small = Math.min(w, h) * cell < 44;
  const color = cat?.color ?? "#C4C9CC";
  const icon = item.icon || cat?.icon || "📦";
  const showPhoto = opts.tileStyle === "photo" && item.photoId;
  const ring =
    opts.showExpiry && state === "expired"
      ? "ring-2 ring-expired"
      : opts.showExpiry && state === "soon"
        ? "ring-2 ring-soon"
        : "ring-1 ring-black/10 dark:ring-white/10";

  const style: CSSProperties = {
    left: (item.gridX ?? 0) * cell + 2,
    top: (item.gridY ?? 0) * cell + 2,
    width: w * cell - 4,
    height: h * cell - 4,
    // Gestapelte Artikel liegen leicht versetzt „darauf“
    transform: `translate(${-level * 3}px, ${-level * 6}px)`,
    zIndex: 10 + level,
    background: opts.tileStyle === "block" || !showPhoto ? `color-mix(in oklab, ${color} 55%, var(--surface))` : undefined,
    animation: highlighted ? "pulse-ring 1.2s ease-out infinite" : undefined,
  };

  return (
    <button
      type="button"
      data-tile={item.id}
      onPointerDown={(e) => onPointerDown?.(e, "move")}
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-label={`${item.name}${level > 0 ? `, gestapelt Ebene ${level + 1}` : ""}. Pfeiltasten verschieben, Umschalt+Pfeil ändert die Größe.`}
      className={`group absolute flex touch-manipulation flex-col items-center justify-center overflow-hidden rounded-lg text-center shadow-[0_2px_0_rgb(0_0_0/0.12)] transition-[opacity,box-shadow,transform] duration-150 select-none hover:shadow-[var(--shadow-lift)] focus-visible:outline-offset-0 ${ring} ${
        dimmed ? "opacity-30" : ""
      } ${dragging ? "opacity-40" : ""}`}
      style={style}
    >
      {showPhoto ? (
        <img src={photoUrl(item.photoId!)} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
      ) : (
        opts.tileStyle !== "block" && (
          <span aria-hidden style={{ fontSize: Math.max(14, Math.min(w, h) * cell * 0.45) }} className="leading-none">
            {icon}
          </span>
        )
      )}
      {opts.showNames && !small && (
        <span
          className={`absolute inset-x-0 bottom-0 truncate px-1 text-[11px] leading-4 font-medium ${
            showPhoto ? "bg-black/55 text-white" : "text-[#1f2b30]"
          }`}
        >
          {item.name}
        </span>
      )}
      {opts.tileStyle === "block" && small && (
        <span aria-hidden className="text-[10px] font-semibold text-[#1f2b30]">
          {item.name.slice(0, 2)}
        </span>
      )}
      {opts.showExpiry && (state === "expired" || state === "soon") && (
        <span
          className={`absolute top-0.5 right-0.5 grid size-4 place-items-center rounded-full ${state === "expired" ? "bg-expired text-on-expired" : "bg-soon text-surface"}`}
          aria-hidden
        >
          {state === "expired" ? <AlertTriangle className="size-2.5" /> : <Clock className="size-2.5" />}
        </span>
      )}
      {resizeHandle && (
        <span
          onPointerDown={(e) => {
            e.stopPropagation();
            onPointerDown?.(e, "resize");
          }}
          className="absolute right-0 bottom-0 size-4 cursor-se-resize rounded-tl-md bg-steel/80 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      )}
    </button>
  );
}

/* ---------------- Rasterfläche eines Fachs ---------------- */

export function Surface({
  compartment,
  placed,
  cell,
  opts,
  preview,
  selection,
  renderTile,
  onCellClick,
  tint,
  children,
}: {
  compartment: Compartment;
  placed: (Placed & { item: Item })[];
  cell: number;
  opts: TileOptions;
  /** Vorschau beim Ziehen: grün = passt, rot = passt nicht */
  preview?: (Rect & { ok: boolean; label?: string }) | null;
  /** Ausgewählter Platz (Formular) */
  selection?: Rect | null;
  renderTile?: (p: Placed & { item: Item }) => ReactNode;
  onCellClick?: (x: number, y: number) => void;
  tint?: "fridge" | "freezer";
  children?: ReactNode;
}) {
  const { gridCols: cols, gridRows: rows } = compartment;
  const lineColor = "color-mix(in oklab, var(--ink) 12%, transparent)";
  return (
    <div
      className={`relative rounded-md ${tint === "freezer" ? "bg-ice" : "bg-surface"}`}
      style={{
        width: cols * cell,
        height: rows * cell,
        backgroundImage: `linear-gradient(to right, ${lineColor} 1px, transparent 1px), linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`,
        backgroundSize: `${cell}px ${cell}px`,
        boxShadow: `inset 0 0 0 1px ${lineColor}`,
      }}
    >
      {/* Zellen – Ziel für Klicks und für die Treffererkennung beim Ziehen */}
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${cols}, ${cell}px)`, gridTemplateRows: `repeat(${rows}, ${cell}px)` }}>
        {Array.from({ length: cols * rows }, (_, i) => {
          const x = i % cols;
          const y = Math.floor(i / cols);
          return onCellClick ? (
            <button
              key={i}
              type="button"
              data-cell={`${compartment.id}:${x}:${y}`}
              onClick={() => onCellClick(x, y)}
              className="hover:bg-steel/15"
              aria-label={`Spalte ${x + 1}, Reihe ${y + 1}`}
            />
          ) : (
            <div key={i} data-cell={`${compartment.id}:${x}:${y}`} />
          );
        })}
      </div>

      {placed.map((p) =>
        renderTile ? (
          <Fragment key={p.id}>{renderTile(p)}</Fragment>
        ) : (
          <Tile key={p.id} item={p.item} cell={cell} opts={opts} />
        ),
      )}

      {selection && (
        <div
          className="pointer-events-none absolute z-40 rounded-lg border-2 border-steel bg-steel/20"
          style={{ left: selection.x * cell, top: selection.y * cell, width: selection.w * cell, height: selection.h * cell }}
        />
      )}
      {preview && (
        <div
          className={`pointer-events-none absolute z-40 grid place-items-center rounded-lg border-2 border-dashed text-[11px] font-semibold ${
            preview.ok ? "border-fresh bg-fresh/20 text-fresh" : "border-expired bg-expired/20 text-expired"
          }`}
          style={{ left: preview.x * cell, top: preview.y * cell, width: preview.w * cell, height: preview.h * cell }}
        >
          {preview.label}
        </div>
      )}
      {children}
    </div>
  );
}
