import { AlertTriangle, CheckCircle2, Clock, Refrigerator, Snowflake, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { photoUrl, useMeta } from "../api";
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
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface shadow-xl outline-none md:rounded-3xl ${
          wide ? "md:max-w-2xl" : "md:max-w-lg"
        }`}
        style={{ animation: "sheet-up 180ms ease-out" }}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0 flex-1 text-lg font-semibold">{title}</div>
          <button className="-mr-2 grid size-11 place-items-center rounded-full hover:bg-frost" onClick={onClose} aria-label="Schließen">
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

export function ExpiryBadge({ bestBefore, compact }: { bestBefore: string | null; compact?: boolean }) {
  const meta = useMeta();
  const state = expiryState(bestBefore, meta.data?.expiringSoonDays);
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
  const meta = useMeta();
  return (category: string, icon?: string | null) =>
    icon || meta.data?.categories.find((c) => c.id === category)?.icon || "📦";
}

export function ItemThumb({ item, size = 48 }: { item: Pick<Item, "photoId" | "icon" | "category" | "name">; size?: number }) {
  const iconFor = useCategoryIcon();
  if (item.photoId) {
    return (
      <img
        src={photoUrl(item.photoId)}
        alt=""
        loading="lazy"
        className="shrink-0 rounded-xl object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl bg-frost"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      aria-hidden
    >
      {iconFor(item.category, item.icon)}
    </span>
  );
}

export function ApplianceIcon({ type, className = "size-5" }: { type: ApplianceType | null; className?: string }) {
  return type === "freezer" ? <Snowflake className={className} aria-hidden /> : <Refrigerator className={className} aria-hidden />;
}

/* ---------------- Artikelzeile ---------------- */

export function ItemRow({ item, showLocation }: { item: Item; showLocation?: boolean }) {
  const { openItem } = useUi();
  // In der Geräteansicht steht das Fach schon als Überschrift
  const where = showLocation ? [item.applianceName, item.compartmentName].filter(Boolean).join(", ") : item.position;
  return (
    <button
      onClick={() => openItem(item.id)}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-frost/70"
    >
      <ItemThumb item={item} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.name}</span>
        <span className="block truncate text-sm text-ink-soft">
          {[formatQuantity(item.quantity, item.unit), where].filter(Boolean).join(" · ")}
        </span>
      </span>
      <ExpiryBadge bestBefore={item.bestBefore} compact />
    </button>
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
          className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-lg ${
            t.tone === "error" ? "bg-expired" : "bg-ink"
          }`}
          style={{ animation: "toast-in 160ms ease-out" }}
        >
          <span className="flex-1 text-sm">{t.message}</span>
          {t.action && (
            <button
              className="rounded-lg px-2 py-1 text-sm font-semibold text-tape hover:bg-white/10"
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
