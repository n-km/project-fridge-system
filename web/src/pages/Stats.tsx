import { AlertTriangle, Clock, Package, Table2 } from "lucide-react";
import { useState } from "react";
import { useCategories, useStats } from "../api";
import { Empty, Spinner } from "../components/common";
import type { Stats as StatsT } from "../types";

/**
 * Farben der Entnahme-Serien (validiert: Helligkeit, Chroma, Farbsehschwäche).
 * „Verschenkt“ und „Sonstiges“ teilen sich eine Serie.
 */
const SERIES = [
  { key: "consumed", label: "Verbraucht", color: "#2E8B57" },
  { key: "shared", label: "Verschenkt / Sonstiges", color: "#4F6FD0" },
  { key: "discarded", label: "Weggeworfen", color: "#C7422E" },
] as const;

const monthLabel = (m: string) =>
  new Intl.DateTimeFormat("de-DE", { month: "short" }).format(new Date(`${m}-15T12:00:00`));

export function Stats() {
  const stats = useStats();
  if (stats.isLoading) return <Spinner />;
  const s = stats.data;
  if (!s) return null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold md:text-3xl">Statistik</h1>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={<Package className="size-5 text-steel" />} value={s.totals.active} label="Artikel im Bestand" />
        <Tile icon={<Clock className="size-5 text-soon" />} value={s.totals.expiringSoon} label="bald fällig" />
        <Tile icon={<AlertTriangle className="size-5 text-expired" />} value={s.totals.expired} label="abgelaufen" />
        <WasteTile w={s.waste90d} />
      </section>

      <RemovalsChart data={s.removalsByMonth} />

      <div className="grid gap-6 md:grid-cols-2">
        <CategoryBreakdown data={s.byCategory} total={s.totals.active} />
        <section className="rounded-3xl bg-surface p-5">
          <h2 className="font-semibold">Am häufigsten weggeworfen</h2>
          {s.topDiscarded.length === 0 ? (
            <p className="mt-2 text-ink-soft">Noch nichts weggeworfen – weiter so.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {s.topDiscarded.map((t) => (
                <li key={t.name} className="flex items-center gap-3">
                  <span className="text-xl" aria-hidden>
                    {t.icon ?? "📦"}
                  </span>
                  <span className="flex-1">{t.name}</span>
                  <span className="tabular-nums text-ink-soft">{t.count}×</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function Tile({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4">
      {icon}
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      <div className="text-sm text-ink-soft">{label}</div>
    </div>
  );
}

function WasteTile({ w }: { w: StatsT["waste90d"] }) {
  return (
    <div className="rounded-3xl bg-surface p-4">
      <span className="text-xl" aria-hidden>
        🗑️
      </span>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{w.rate == null ? "–" : `${Math.round(w.rate * 100)} %`}</div>
      <div className="text-sm text-ink-soft">
        weggeworfen, letzte 90 Tage{w.total > 0 && ` (${w.discarded} von ${w.total})`}
      </div>
    </div>
  );
}

/* ---------------- Gestapeltes Säulendiagramm: Entnahmen pro Monat ---------------- */

function RemovalsChart({ data }: { data: StatsT["removalsByMonth"] }) {
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const rows = data.map((d) => ({
    month: d.month,
    consumed: d.consumed,
    shared: d.given_away + d.other,
    discarded: d.discarded,
    total: d.consumed + d.given_away + d.other + d.discarded,
  }));
  const max = Math.max(1, ...rows.map((r) => r.total));
  const niceMax = Math.max(4, Math.ceil(max / 4) * 4);
  const ticks = [0, 0.5, 1].map((t) => Math.round(niceMax * t));
  const empty = rows.every((r) => r.total === 0);

  return (
    <section className="rounded-3xl bg-surface p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="font-semibold">Entnahmen pro Monat</h2>
        <button className="chip ml-auto" aria-pressed={table} onClick={() => setTable((t) => !t)}>
          <Table2 className="size-4" /> Tabelle
        </button>
      </div>
      {/* Legende */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}
          </li>
        ))}
      </ul>

      {empty ? (
        <Empty title="Noch keine Entnahmen">Sobald Artikel entnommen werden, erscheinen sie hier.</Empty>
      ) : table ? (
        <table className="mt-4 w-full text-sm tabular-nums">
          <thead className="text-left text-ink-soft">
            <tr>
              <th className="py-1 font-medium">Monat</th>
              {SERIES.map((s) => (
                <th key={s.key} className="py-1 text-right font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.month}>
                <td className="py-1.5">{monthLabel(r.month)}</td>
                {SERIES.map((s) => (
                  <td key={s.key} className="py-1.5 text-right">
                    {r[s.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mt-4 flex gap-2">
          {/* y-Achse */}
          <div className="relative h-48 w-6 shrink-0 text-right text-xs text-ink-faint tabular-nums" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `calc(${(t / niceMax) * 100}% - 0.5rem)` }}>
                {t}
              </span>
            ))}
          </div>
          <div className="flex-1">
            <div className="relative h-48">
              {ticks.map((t) => (
                <div key={t} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${(t / niceMax) * 100}%` }} aria-hidden />
              ))}
              <div className="absolute inset-0 flex items-end justify-around gap-2">
                {rows.map((r, i) => (
                  <div
                    key={r.month}
                    className="relative flex h-full w-full max-w-12 flex-col justify-end"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    tabIndex={0}
                    role="img"
                    aria-label={`${monthLabel(r.month)}: ${SERIES.map((s) => `${s.label} ${r[s.key]}`).join(", ")}`}
                  >
                    {/* Segmente von unten nach oben, 2px Abstand */}
                    <div className="flex flex-col-reverse gap-[2px]">
                      {SERIES.map((s, si) => {
                        const v = r[s.key];
                        if (!v) return null;
                        const top = SERIES.slice(si + 1).every((x) => !r[x.key]);
                        return (
                          <div
                            key={s.key}
                            style={{ height: `${(v / niceMax) * 12}rem`, background: s.color }}
                            className={top ? "rounded-t-[4px]" : ""}
                          />
                        );
                      })}
                    </div>
                    {hover === i && (
                      <div className="absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-xs text-surface shadow-lg">
                        <div className="mb-1 font-semibold">{monthLabel(r.month)}</div>
                        {SERIES.map((s) => (
                          <div key={s.key} className="flex items-center gap-2">
                            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
                            <span className="flex-1">{s.label}</span>
                            <span className="tabular-nums">{r[s.key]}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-1 flex justify-around gap-2 text-xs text-ink-soft">
              {rows.map((r) => (
                <span key={r.month} className="w-full max-w-12 text-center">
                  {monthLabel(r.month)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------------- Bestand nach Kategorie ---------------- */

function CategoryBreakdown({ data, total }: { data: StatsT["byCategory"]; total: number }) {
  const categories = useCategories({ includeHidden: true });
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <section className="rounded-3xl bg-surface p-5">
      <h2 className="font-semibold">Bestand nach Kategorie</h2>
      {total === 0 ? (
        <p className="mt-2 text-ink-soft">Gerade ist nichts eingelagert.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {data.map((d) => {
            const c = categories.find((x) => x.id === d.category);
            return (
              <li key={d.category} className="grid grid-cols-[1.5rem_8rem_1fr_2rem] items-center gap-2 text-sm">
                <span aria-hidden>{c?.icon}</span>
                <span className="truncate">{c?.label ?? d.category}</span>
                <span className="h-3 rounded-r-[4px] bg-steel" style={{ width: `${(d.count / max) * 100}%` }} aria-hidden />
                <span className="text-right tabular-nums text-ink-soft">{d.count}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
