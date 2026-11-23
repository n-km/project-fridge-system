import { AlertTriangle, ChevronDown, Clock, DoorClosed, DoorOpen, Search, Snowflake, Wand2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ApiError, photoUrl, placeItem, useUserSettings } from "../../api";
import { checkSpot, findFree, placedIn } from "../../lib/grid";
import type { Appliance, Compartment, Item, UserSettings } from "../../types";
import { useUi } from "../../ui";
import { useCategoryIcon, useExpiry } from "../common";
import { Surface, Tile, type TileOptions } from "./Surface";
import { useGridDrag } from "./useGridDrag";

/** Höchstgröße eines Felds; die Fächer füllen die verfügbare Breite bis zu dieser Grenze. */
const CELL_PX = { S: 52, M: 76, L: 100 } as const;
const TILT = {
  flat: { shelf: 0, drawer: 0, door: 0 },
  subtle: { shelf: 26, drawer: 38, door: -9 },
  strong: { shelf: 44, drawer: 54, door: -18 },
} as const;

type Ext = UserSettings["extended"];

const DEFAULT_EXT: Ext = { perspective: "subtle", tileStyle: "photo", cellSize: "M", showNames: true, showExpiry: true, openIn3d: true };

/**
 * 2,5D-Ansicht eines Kühlgeräts: perspektivisch gekippte Rasterflächen (CSS-3D),
 * Schubladen zum Herausziehen, Türfächer, Truhe von oben.
 * Alles bleibt normales HTML – per Tastatur bedienbar und für Screenreader lesbar.
 */
export function Fridge3D({ appliance, items }: { appliance: Appliance; items: Item[] }) {
  const settings = useUserSettings();
  const ext = settings.data?.extended ?? DEFAULT_EXT;
  const { openItem, toast } = useUi();
  const [query, setQuery] = useState("");
  const [doorOpen, setDoorOpen] = useState(false);
  const [openDrawers, setOpenDrawers] = useState<Set<string>>(new Set());
  const [announce, setAnnounce] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);

  // Verfügbare Breite messen → Zellgröße anpassen
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Der eine inszenierte Moment: Tür öffnet sich beim Betreten
  useEffect(() => {
    const t = window.setTimeout(() => setDoorOpen(true), 120);
    return () => window.clearTimeout(t);
  }, [appliance.id]);

  const chest = appliance.layout === "chest";
  const doorBins = chest ? [] : appliance.compartments.filter((c) => c.kind === "door");
  const body = chest ? appliance.compartments : appliance.compartments.filter((c) => c.kind !== "door");
  const sideBySide = width >= 640 && doorBins.length > 0;
  const bodyWidth = sideBySide ? width * 0.68 - 24 : width - 24;
  const doorWidth = sideBySide ? width * 0.32 - 24 : width - 24;
  const cellFor = (c: Compartment, avail: number) => Math.max(22, Math.min(CELL_PX[ext.cellSize], Math.floor(avail / c.gridCols)));

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => new Set(q ? items.filter((i) => i.name.toLowerCase().includes(q)).map((i) => i.id) : []), [items, q]);

  // Suche: Schubladen mit Treffern öffnen sich
  useEffect(() => {
    if (!q) return;
    const withHits = new Set(items.filter((i) => matches.has(i.id) && i.compartmentId).map((i) => i.compartmentId!));
    if (withHits.size) setOpenDrawers((s) => new Set([...s, ...withHits]));
  }, [q, matches, items]);

  const { drag, startDrag, consumeClick } = useGridDrag({
    compartments: appliance.compartments,
    items,
    onHoverCompartment: (id) => setOpenDrawers((s) => (s.has(id) ? s : new Set([...s, id]))),
    onError: (msg) => toast({ message: msg, tone: "error" }),
    onDone: (item, where) => setAnnounce(where === "placed" ? `${item.name} verschoben` : `${item.name} aus dem Raster genommen`),
  });

  const opts: TileOptions = { tileStyle: ext.tileStyle, showNames: ext.showNames, showExpiry: ext.showExpiry };
  const tilt = TILT[ext.perspective];

  /** Pfeiltasten verschieben, Umschalt+Pfeil ändert die Größe. */
  async function onTileKey(e: React.KeyboardEvent, item: Item, c: Compartment) {
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = dirs[e.key];
    if (!d || item.gridX == null) return;
    e.preventDefault();
    const r = { x: item.gridX, y: item.gridY!, w: item.gridW ?? 1, h: item.gridH ?? 1 };
    const next = e.shiftKey ? { ...r, w: Math.max(1, r.w + d[0]), h: Math.max(1, r.h + d[1]) } : { ...r, x: r.x + d[0], y: r.y + d[1] };
    const v = checkSpot(c, placedIn(items, c.id), next, item.id);
    if (!v.ok) return setAnnounce(v.reason);
    try {
      await placeItem(item.id, { compartmentId: c.id, gridX: next.x, gridY: next.y, gridW: next.w, gridH: next.h });
      setAnnounce(e.shiftKey ? `Größe ${next.w} mal ${next.h}` : `Spalte ${next.x + 1}, Reihe ${next.y + 1}`);
      // Fokus bleibt auf der Kachel
      requestAnimationFrame(() => (document.querySelector(`[data-tile="${item.id}"]`) as HTMLElement | null)?.focus());
    } catch (err) {
      setAnnounce(err instanceof ApiError ? err.message : "Verschieben fehlgeschlagen");
    }
  }

  const surface = (c: Compartment, avail: number) => {
    const cell = cellFor(c, avail);
    const placed = placedIn(items, c.id);
    const t = drag?.target;
    const preview =
      t?.kind === "cell" && t.compartmentId === c.id
        ? { x: t.x, y: t.y, w: t.w, h: t.h, ok: t.ok, label: t.ok ? (t.level > 0 ? `Ebene ${t.level + 1}` : "") : t.reason }
        : null;
    return (
      <Surface
        compartment={c}
        placed={placed}
        cell={cell}
        opts={opts}
        preview={preview}
        tint={(c.zone ?? appliance.type) === "freezer" ? "freezer" : "fridge"}
        renderTile={(p) => (
          <Tile
            item={p.item}
            cell={cell}
            opts={opts}
            dimmed={!!q && !matches.has(p.id)}
            highlighted={!!q && matches.has(p.id)}
            dragging={drag?.item.id === p.id}
            resizeHandle
            onPointerDown={(e, mode) => startDrag(e, p.item, mode, cell)}
            onClick={() => !consumeClick() && openItem(p.id)}
            onKeyDown={(e) => onTileKey(e, p.item, c)}
          />
        )}
      />
    );
  };

  const counts = (c: Compartment) => {
    const list = items.filter((i) => i.compartmentId === c.id);
    return list;
  };

  return (
    <div ref={rootRef} className="space-y-4" onContextMenu={(e) => drag && e.preventDefault()}>
      {/* Werkzeugleiste */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">In diesem Gerät suchen</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
          <input className="input min-h-10 pl-9 text-sm" type="search" placeholder="Wo ist …?" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button className="btn-quiet min-h-10 text-sm" onClick={() => setDoorOpen((o) => !o)} aria-pressed={!doorOpen}>
          {doorOpen ? <DoorClosed className="size-4" /> : <DoorOpen className="size-4" />}
          {doorOpen ? (chest ? "Deckel zu" : "Tür zu") : chest ? "Deckel auf" : "Tür auf"}
        </button>
        {!chest && body.some((c) => c.kind === "drawer") && (
          <button
            className="btn-quiet min-h-10 text-sm"
            onClick={() =>
              setOpenDrawers((s) => (s.size ? new Set() : new Set(body.filter((c) => c.kind === "drawer").map((c) => c.id))))
            }
          >
            <ChevronDown className={`size-4 transition-transform ${openDrawers.size ? "rotate-180" : ""}`} />
            {openDrawers.size ? "Schubladen zu" : "Schubladen auf"}
          </button>
        )}
      </div>
      {q && (
        <p className="text-sm text-ink-soft" aria-live="polite">
          {matches.size ? `${matches.size} Treffer – hervorgehoben` : `Nichts gefunden zu „${query}“`}
        </p>
      )}

      {/* Gerät */}
      <div className="relative" style={{ perspective: 1400 }}>
        <div
          className={`rounded-[28px] border-2 p-3 transition-colors ${
            appliance.type === "freezer" ? "border-ice-ink/20 bg-ice/60" : "border-steel/20 bg-steel-tint/60"
          }`}
          style={appliance.color ? { borderColor: `color-mix(in oklab, ${appliance.color} 45%, transparent)` } : undefined}
        >
          {chest ? (
            <ChestInterior compartments={body} counts={counts} surface={(c) => surface(c, width - 24)} widthAvail={width - 24} cellFor={cellFor} />
          ) : (
            <div className={sideBySide ? "flex items-start gap-3" : "space-y-4"}>
              <div className="min-w-0 flex-1 space-y-3">
                {body.map((c) =>
                  c.kind === "drawer" ? (
                    <Drawer
                      key={c.id}
                      c={c}
                      open={openDrawers.has(c.id)}
                      onToggle={() =>
                        setOpenDrawers((s) => {
                          const n = new Set(s);
                          if (n.has(c.id)) n.delete(c.id);
                          else n.add(c.id);
                          return n;
                        })
                      }
                      items={counts(c)}
                      tiltDeg={tilt.drawer}
                      zoneFreezer={(c.zone ?? appliance.type) === "freezer"}
                      zoneDiffers={!!c.zone && c.zone !== appliance.type}
                      height={cellFor(c, bodyWidth) * c.gridRows}
                    >
                      {surface(c, bodyWidth)}
                    </Drawer>
                  ) : (
                    <Shelf
                      key={c.id}
                      c={c}
                      tiltDeg={tilt.shelf}
                      count={counts(c).length}
                      zoneFreezer={(c.zone ?? appliance.type) === "freezer"}
                      zoneDiffers={!!c.zone && c.zone !== appliance.type}
                      height={cellFor(c, bodyWidth) * c.gridRows}
                    >
                      {surface(c, bodyWidth)}
                    </Shelf>
                  ),
                )}
              </div>
              {doorBins.length > 0 && (
                <div
                  className="space-y-3 rounded-2xl border border-line bg-surface/50 p-2"
                  style={{ transform: `rotateY(${tilt.door}deg)`, transformOrigin: "left center", width: sideBySide ? doorWidth + 16 : undefined }}
                >
                  <p className="px-1 text-xs font-medium text-ink-soft">Tür innen</p>
                  {doorBins.map((c) => (
                    <div key={c.id}>
                      <div className="mb-1 flex items-center justify-between px-1 text-sm">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-ink-faint tabular-nums">{counts(c).length}</span>
                      </div>
                      <div className="mx-auto w-fit max-w-full overflow-x-auto rounded-b-xl border-b-[6px] border-steel/25 pb-0.5">{surface(c, doorWidth)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tür bzw. Deckel – öffnet sich perspektivisch */}
        <DoorPanel appliance={appliance} open={doorOpen} chest={chest} onOpen={() => setDoorOpen(true)} />
      </div>

      <Tray appliance={appliance} items={items} drag={!!drag} startDrag={startDrag} consumeClick={consumeClick} />

      {/* Geist unter dem Finger/Mauszeiger beim Ziehen */}
      {drag && <Ghost item={drag.item} x={drag.pointer.x} y={drag.pointer.y} />}

      <p className="sr-only" aria-live="assertive">
        {announce}
      </p>
    </div>
  );
}

/* ---------------- Glasboden / Ablage ---------------- */

function Shelf({
  c,
  tiltDeg,
  count,
  zoneFreezer,
  zoneDiffers,
  height,
  children,
}: {
  c: Compartment;
  tiltDeg: number;
  count: number;
  zoneFreezer: boolean;
  zoneDiffers: boolean;
  height: number;
  children: React.ReactNode;
}) {
  // Gekippte Fläche wird optisch niedriger → Lücke oben ausgleichen
  const shrink = height * (1 - Math.cos((tiltDeg * Math.PI) / 180));
  const edge = c.kind === "bottle" ? "rounded-b-[18px] border-b-[5px]" : c.kind === "basket" ? "border-4 rounded-xl" : "border-b-[6px] rounded-b-md";
  return (
    <section aria-label={c.name}>
      <div className="mb-1 flex items-center gap-2 px-1 text-sm">
        <span className="font-medium">{c.name}</span>
        {zoneFreezer && zoneDiffers && <Snowflake className="size-3.5 text-ice-ink" aria-label="Gefrierbereich" />}
        <span className="text-xs text-ink-faint tabular-nums">{count}</span>
      </div>
      <div className="overflow-x-auto overflow-y-visible pt-2" style={{ perspective: 900, marginTop: -shrink }}>
        <div
          className={`mx-auto w-fit ${edge} ${zoneFreezer ? "border-ice-ink/25" : "border-steel/25"}`}
          style={{ transform: `rotateX(${tiltDeg}deg)`, transformOrigin: "50% 100%", transformStyle: "preserve-3d" }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Schublade ---------------- */

function Drawer({
  c,
  open,
  onToggle,
  items,
  tiltDeg,
  zoneFreezer,
  zoneDiffers,
  height,
  children,
}: {
  c: Compartment;
  zoneDiffers: boolean;
  open: boolean;
  onToggle: () => void;
  items: Item[];
  tiltDeg: number;
  zoneFreezer: boolean;
  height: number;
  children: React.ReactNode;
}) {
  const expiry = useExpiry();
  const expired = items.filter((i) => expiry(i.bestBefore) === "expired").length;
  const soon = items.filter((i) => expiry(i.bestBefore) === "soon").length;
  const shrink = height * (1 - Math.cos((tiltDeg * Math.PI) / 180));
  const front: CSSProperties = { minHeight: 36 + c.height * 10 };
  return (
    <section aria-label={c.name}>
      {open && (
        <div className="overflow-x-auto pt-2" style={{ perspective: 800, marginTop: -shrink * 0.9, animation: "drawer-out 240ms cubic-bezier(0.2, 0.7, 0.2, 1)" }}>
          <div
            className={`mx-auto w-fit rounded-t-lg border-x-4 border-t-4 ${zoneFreezer ? "border-ice-ink/20" : "border-steel/20"}`}
            style={{ transform: `rotateX(${tiltDeg}deg)`, transformOrigin: "50% 100%" }}
          >
            {children}
          </div>
        </div>
      )}
      {/* Front der Schublade – Klick zieht heraus / schiebt zurück */}
      <button
        type="button"
        data-drawer={c.id}
        onClick={onToggle}
        aria-expanded={open}
        className={`lift flex w-full items-center gap-3 rounded-xl border px-4 text-left ${
          zoneFreezer ? "border-ice-ink/20 bg-ice" : "border-line bg-surface"
        } ${open ? "rounded-t-none" : ""}`}
        style={front}
      >
        <span className="h-1.5 w-12 shrink-0 rounded-full bg-ink-faint/50" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-medium">
            {c.name}
            {zoneFreezer && zoneDiffers && <Snowflake className="size-3.5 text-ice-ink" aria-label="Gefrierbereich" />}
          </span>
          {!open && <span className="block text-xs text-ink-soft">{items.length} Artikel</span>}
        </span>
        {!open && expired > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-expired-tint px-2 py-0.5 text-xs font-medium text-expired">
            <AlertTriangle className="size-3" aria-hidden /> {expired}
          </span>
        )}
        {!open && soon > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-soon-tint px-2 py-0.5 text-xs font-medium text-soon">
            <Clock className="size-3" aria-hidden /> {soon}
          </span>
        )}
        <ChevronDown className={`size-5 shrink-0 text-ink-soft transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
    </section>
  );
}

/* ---------------- Truhe (von oben) ---------------- */

function ChestInterior({
  compartments,
  counts,
  surface,
}: {
  compartments: Compartment[];
  counts: (c: Compartment) => Item[];
  surface: (c: Compartment) => React.ReactNode;
  widthAvail: number;
  cellFor: (c: Compartment, avail: number) => number;
}) {
  const [lifted, setLifted] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-start gap-3">
      {compartments.map((c) => {
        const up = lifted === c.id;
        return (
          <section
            key={c.id}
            aria-label={c.name}
            className={`rounded-xl transition-transform duration-200 ${c.kind === "basket" ? "border-4 border-ice-ink/25 bg-surface/40 p-1" : ""} ${
              up ? "-translate-y-1.5 shadow-[var(--shadow-lift)]" : ""
            }`}
          >
            <button
              type="button"
              className="mb-1 flex w-full items-center justify-between gap-2 px-1 text-sm"
              onClick={() => c.kind === "basket" && setLifted(up ? null : c.id)}
              aria-pressed={c.kind === "basket" ? up : undefined}
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-ink-faint tabular-nums">
                {counts(c).length}
                {c.kind === "basket" && (up ? " · angehoben" : " · anheben")}
              </span>
            </button>
            <div className="overflow-x-auto">{surface(c)}</div>
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- Tür / Deckel ---------------- */

function DoorPanel({ appliance, open, chest, onOpen }: { appliance: Appliance; open: boolean; chest: boolean; onOpen: () => void }) {
  const freezer = appliance.type === "freezer";
  const transform = chest ? (open ? "rotateX(96deg)" : "rotateX(0deg)") : open ? "rotateY(-104deg)" : "rotateY(0deg)";
  return (
    <button
      type="button"
      onClick={onOpen}
      tabIndex={open ? -1 : 0}
      aria-hidden={open}
      aria-label={`${appliance.name} öffnen`}
      className={`absolute inset-0 z-50 flex flex-col rounded-[28px] border-2 p-5 text-left ${
        freezer ? "border-ice-ink/20 bg-ice" : "border-steel/20 bg-steel-tint"
      }`}
      style={{
        transform,
        transformOrigin: chest ? "50% 0%" : "0% 50%",
        transition: "transform 520ms cubic-bezier(0.3, 0.7, 0.2, 1), opacity 200ms 380ms",
        opacity: open ? 0 : 1,
        pointerEvents: open ? "none" : "auto",
        backfaceVisibility: "hidden",
        background: appliance.color ? `color-mix(in oklab, ${appliance.color} 30%, var(--surface))` : undefined,
      }}
    >
      <span
        className={`absolute rounded-full ${freezer ? "bg-ice-ink/30" : "bg-steel/30"} ${
          chest ? "bottom-4 left-1/2 h-2 w-1/4 -translate-x-1/2" : "top-1/2 right-4 h-1/4 w-2 -translate-y-1/2"
        }`}
        aria-hidden
      />
      <span className="tape text-3xl">{appliance.name}</span>
      {appliance.location && <span className="mt-2 text-sm text-ink-soft">{appliance.location}</span>}
      <span className="mt-auto text-sm text-ink-soft">Antippen zum Öffnen</span>
    </button>
  );
}

/* ---------------- Ablage: noch nicht platzierte Artikel ---------------- */

function Tray({
  appliance,
  items,
  drag,
  startDrag,
  consumeClick,
}: {
  appliance: Appliance;
  items: Item[];
  drag: boolean;
  startDrag: ReturnType<typeof useGridDrag>["startDrag"];
  consumeClick: () => boolean;
}) {
  const { openItem, toast } = useUi();
  const iconFor = useCategoryIcon();
  const unplaced = items.filter((i) => i.gridX == null);
  const [busy, setBusy] = useState(false);

  async function autoAll() {
    setBusy(true);
    let placedCount = 0;
    let local = [...items];
    for (const it of unplaced) {
      const c = appliance.compartments.find((x) => x.id === it.compartmentId);
      if (!c) continue;
      const free = findFree(c, placedIn(local, c.id), it.gridW ?? 1, it.gridH ?? 1, it.id);
      if (!free) continue;
      try {
        const updated = await placeItem(it.id, { compartmentId: c.id, gridX: free.x, gridY: free.y, gridW: free.w, gridH: free.h });
        local = local.map((x) => (x.id === it.id ? updated : x));
        placedCount++;
      } catch {
        /* nächster */
      }
    }
    setBusy(false);
    toast({
      message:
        placedCount === unplaced.length
          ? `${placedCount} Artikel einsortiert`
          : `${placedCount} von ${unplaced.length} einsortiert – Artikel ohne Fach oder ohne Platz bleiben in der Ablage`,
    });
  }

  return (
    <section
      data-tray
      aria-label="Noch nicht platziert"
      className={`rounded-2xl border-2 border-dashed p-3 transition-colors ${drag ? "border-steel bg-steel-tint/40" : "border-line"}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-medium">Noch nicht platziert</h3>
        <span className="text-sm text-ink-faint tabular-nums">{unplaced.length}</span>
        {unplaced.some((i) => i.compartmentId) && (
          <button className="btn-quiet ml-auto min-h-9 text-sm" disabled={busy} onClick={autoAll}>
            <Wand2 className="size-4" /> Alle einsortieren
          </button>
        )}
      </div>
      {unplaced.length === 0 ? (
        <p className="text-sm text-ink-soft">{drag ? "Hier ablegen, um aus dem Raster zu nehmen." : "Alles hat seinen Platz."}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {unplaced.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                className="chip touch-manipulation"
                onPointerDown={(e) => startDrag(e, i, "move", 48)}
                onClick={() => !consumeClick() && openItem(i.id)}
                title={i.compartmentName ? `Fach: ${i.compartmentName}` : "Kein Fach – zum Platzieren auf ein Fach ziehen"}
              >
                <span aria-hidden>{iconFor(i.category, i.icon)}</span>
                {i.name}
                {!i.compartmentName && <span className="text-xs text-ink-faint">· kein Fach</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {unplaced.length > 0 && <p className="mt-2 text-xs text-ink-soft">Auf ein Fach ziehen (auf Touch-Geräten lange drücken) oder antippen für Details.</p>}
    </section>
  );
}

/* ---------------- Geist beim Ziehen ---------------- */

function Ghost({ item, x, y }: { item: Item; x: number; y: number }) {
  const iconFor = useCategoryIcon();
  return (
    <div
      className="pointer-events-none fixed z-[70] grid size-14 place-items-center overflow-hidden rounded-xl bg-surface text-3xl shadow-[var(--shadow-lift)] ring-2 ring-steel"
      style={{ left: x - 28, top: y - 40, transform: "rotate(-4deg)" }}
      aria-hidden
    >
      {item.photoId ? <img src={photoUrl(item.photoId)} alt="" className="size-full object-cover" /> : iconFor(item.category, item.icon)}
    </div>
  );
}
