import { AlertTriangle, CheckCircle2, Clock, PackageMinus, Pencil, Refrigerator, Snowflake, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { photoUrl, useCategories, useSoonDays, useUserSettings } from "../api";
import { expiryState, expiryText, formatQuantity } from "../lib/dates";
import type { ApplianceType, Item } from "../types";
import { useUi } from "../ui";

/* ---------------- Sheet (unten auf Mobilgeräten, mittig auf großen Bildschirmen) ---------------- */

export function Sheet({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 bg-scrim" style={{ animation: "fade-in 160ms ease-out" }} onClick={onClose} aria-hidden />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface shadow-xl outline-none md:rounded-3xl ${
          wide ? "md:max-w-2xl" : "md:max-w-lg"
        }`}
        style={{ animation: "sheet-up 200ms cubic-bezier(0.2, 0.7, 0.2, 1)" }}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0 flex-1 text-lg font-semibold">{title}</div>
          <button className="icon-btn -mr-2 size-11" onClick={onClose} aria-label="Schließen">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Haltbarkeits-Ampel ---------------- */

const EXPIRY_STYLE = {
  expired: { cls: "bg-expired-tint text-expired", Icon: AlertTriangle },
  soon: { cls: "bg-soon-tint text-soon", Icon: Clock },
  fresh: { cls: "bg-fresh-tint text-fresh", Icon: CheckCircle2 },
  none: { cls: "bg-frost text-ink-soft", Icon: null },
} as const;

export function useExpiry() {
  const soonDays = useSoonDays();
  return (bestBefore: string | null) => expiryState(bestBefore, soonDays);
}

export function ExpiryBadge({ bestBefore, compact }: { bestBefore: string | null; compact?: boolean }) {
  const state = useExpiry()(bestBefore);
  const { cls, Icon } = EXPIRY_STYLE[state];
  if (compact && state === "none") return null;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {expiryText(bestBefore)}
    </span>
  );
}

/* ---------------- Icons & Vorschaubilder ---------------- */

export function useCategoryIcon() {
  const cats = useCategories({ includeHidden: true });
  return (category: string, icon?: string | null) => icon || cats.find((c) => c.id === category)?.icon || "📦";
}

export function useCategoryInfo() {
  const cats = useCategories({ includeHidden: true });
  return (category: string) => cats.find((c) => c.id === category);
}

export function ItemThumb({ item, size }: { item: Pick<Item, "photoId" | "icon" | "category" | "name">; size?: number }) {
  const iconFor = useCategoryIcon();
  const settings = useUserSettings();
  const dim = size ? `${size}px` : "var(--thumb)";
  if (item.photoId && settings.data?.itemDisplay !== "icon") {
    return (
      <img
        src={photoUrl(item.photoId)}
        alt=""
        loading="lazy"
        className="shrink-0 rounded-xl object-cover"
        style={{ width: dim, height: dim }}
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl bg-frost"
      style={{ width: dim, height: dim, fontSize: `calc(${dim} * 0.55)` }}
      aria-hidden
    >
      {iconFor(item.category, item.icon)}
    </span>
  );
}

export function ApplianceIcon({ type, className = "size-5" }: { type: ApplianceType | null; className?: string }) {
  return type === "freezer" ? <Snowflake className={className} aria-hidden /> : <Refrigerator className={className} aria-hidden />;
}

/* ---------------- Artikelzeile mit Wischgesten ---------------- */

const SWIPE_TRIGGER = 88;

export function ItemRow({ item, showLocation }: { item: Item; showLocation?: boolean }) {
  const { openItem } = useUi();
  const settings = useUserSettings();
  // In der Geräteansicht steht das Fach schon als Überschrift
  const where = showLocation ? [item.applianceName, item.compartmentName].filter(Boolean).join(", ") : item.position;

  const content = (
    <>
      <ItemThumb item={item} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.name}</span>
        <span className="block truncate text-sm text-ink-soft">{[formatQuantity(item.quantity, item.unit), where].filter(Boolean).join(" · ")}</span>
      </span>
      <ExpiryBadge bestBefore={item.bestBefore} compact />
    </>
  );

  if (settings.data?.swipe === false || item.status !== "active") {
    return (
      <button onClick={() => openItem(item.id)} className="row-press flex w-full items-center gap-3 px-3 text-left" style={{ paddingBlock: "var(--row-py)" }}>
        {content}
      </button>
    );
  }
  return <SwipeRow item={item}>{content}</SwipeRow>;
}

/**
 * Wischen auf Touch-Geräten: nach links = entnehmen, nach rechts = bearbeiten.
 * Mit Maus/Tastatur verhält sich die Zeile wie ein normaler Knopf.
 */
function SwipeRow({ item, children }: { item: Item; children: ReactNode }) {
  const { openItem } = useUi();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; locked: "x" | "y" | null } | null>(null);
  const swiped = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    start.current = { x: e.clientX, y: e.clientY, locked: null };
    swiped.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (!s.locked && Math.hypot(mx, my) > 8) s.locked = Math.abs(mx) > Math.abs(my) ? "x" : "y";
    if (s.locked !== "x") return;
    setDragging(true);
    // Widerstand jenseits der Auslöseschwelle
    const limit = SWIPE_TRIGGER * 1.4;
    setDx(Math.max(-limit, Math.min(limit, mx)));
  };
  const finish = () => {
    const s = start.current;
    start.current = null;
    if (!s || s.locked !== "x") return;
    if (dx <= -SWIPE_TRIGGER) openItem(item.id, "remove");
    else if (dx >= SWIPE_TRIGGER) openItem(item.id, "edit");
    swiped.current = Math.abs(dx) > 8;
    setDragging(false);
    setDx(0);
  };

  const reveal = Math.min(1, Math.abs(dx) / SWIPE_TRIGGER);
  return (
    <div className="relative overflow-hidden">
      {/* Aktionen unter der Zeile */}
      <div className="absolute inset-0 flex items-center justify-between px-5 text-sm font-medium" aria-hidden>
        <span className="flex items-center gap-2 text-steel" style={{ opacity: dx > 0 ? reveal : 0 }}>
          <Pencil className="size-5" /> Bearbeiten
        </span>
        <span className="flex items-center gap-2 text-expired" style={{ opacity: dx < 0 ? reveal : 0 }}>
          Entnehmen <PackageMinus className="size-5" />
        </span>
      </div>
      <button
        onClick={() => {
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          openItem(item.id);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        className="row-press relative flex w-full touch-pan-y items-center gap-3 bg-surface px-3 text-left"
        style={{
          paddingBlock: "var(--row-py)",
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1)",
        }}
      >
        {children}
      </button>
    </div>
  );
}

/* ---------------- Ladeplatzhalter ---------------- */

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface" role="status" aria-label="Lädt">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3" style={{ paddingBlock: "var(--row-py)" }}>
          <span className="skeleton shrink-0" style={{ width: "var(--thumb)", height: "var(--thumb)" }} />
          <span className="flex-1 space-y-2">
            <span className="skeleton block h-4 w-2/5" />
            <span className="skeleton block h-3 w-3/5" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function DoorSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton aspect-[4/5] rounded-[28px]" />
      ))}
    </>
  );
}

/* ---------------- Leerer Zustand ---------------- */

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="tape mb-3 text-2xl">{title}</p>
      {children && <div className="mx-auto max-w-sm text-ink-soft">{children}</div>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-10" role="status" aria-label="Lädt">
      <span className="size-7 animate-spin rounded-full border-3 border-steel-tint border-t-steel" />
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl bg-expired-tint px-3 py-2 text-sm text-expired">
      {error instanceof Error ? error.message : String(error)}
    </p>
  );
}

/* ---------------- Schalter ---------------- */

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

/* ---------------- Toasts ---------------- */

export function Toasts() {
  const { toasts, dismissToast } = useUi();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-lg ${
            t.tone === "error" ? "bg-expired text-on-expired" : "bg-ink text-surface dark:bg-surface-raised dark:text-ink dark:ring-1 dark:ring-line"
          }`}
          style={{ animation: "toast-in 180ms cubic-bezier(0.2, 0.7, 0.2, 1)" }}
        >
          <CheckCircle2 className="size-5 shrink-0 opacity-80" aria-hidden />
          <span className="flex-1 text-sm">{t.message}</span>
          {t.action && (
            <button
              className="rounded-lg px-2 py-1 text-sm font-semibold text-tape transition-colors hover:bg-white/10 dark:text-steel"
              onClick={async () => {
                dismissToast(t.id);
                await t.action!.run();
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
