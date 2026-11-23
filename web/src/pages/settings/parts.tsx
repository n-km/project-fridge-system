import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { queryClient } from "../../api";

export const refresh = (...keys: string[]) => Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: [k] })));

export function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold">{title}</h2>
      {intro && <p className="mt-0.5 mb-3 max-w-prose text-ink-soft">{intro}</p>}
      <div className={intro ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-surface ${className}`}>{children}</div>;
}

/** Eine Zeile „Bezeichnung … Steuerelement“. */
export function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
      <div className="min-w-40 flex-1">
        <div className="font-medium">{label}</div>
        {hint && <div className="text-sm text-ink-soft">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-surface" role="group" aria-label={label}>
      <button type="button" className="icon-btn size-9 rounded-l-xl rounded-r-none" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`${label} verringern`}>
        <Minus className="size-4" />
      </button>
      <span className="min-w-10 px-1 text-center tabular-nums" aria-live="polite">
        {value}
        {suffix}
      </span>
      <button type="button" className="icon-btn size-9 rounded-l-none rounded-r-xl" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`${label} erhöhen`}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/** Farbauswahl: Vorschläge + freie Farbe. */
export const SWATCHES = ["#2D6A88", "#3F4F96", "#2E8B57", "#B77400", "#C7422E", "#8E5BA8", "#5F7A80", "#D98BAE"];

export function ColorPicker({ value, onChange, allowNone }: { value: string | null; onChange: (c: string | null) => void; allowNone?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Farbe">
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          aria-label="Standardfarbe"
          className="grid size-8 place-items-center rounded-full border-2 border-dashed border-line text-xs text-ink-soft aria-pressed:border-steel"
        >
          –
        </button>
      )}
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-pressed={value?.toLowerCase() === c.toLowerCase()}
          aria-label={`Farbe ${c}`}
          className="size-8 rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-ink"
          style={{ background: c }}
        />
      ))}
      <label className="relative size-8 cursor-pointer overflow-hidden rounded-full border border-line" title="Eigene Farbe">
        <span className="sr-only">Eigene Farbe</span>
        <span className="absolute inset-0" style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }} aria-hidden />
        <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={value ?? "#2D6A88"} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      </label>
    </div>
  );
}
