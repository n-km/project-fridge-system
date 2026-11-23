import { ChevronLeft, Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAppliances, useItems } from "../api";
import { ApplianceIcon, Empty, ErrorNote, ItemRow, Spinner } from "../components/common";
import type { Item } from "../types";
import { useUi } from "../ui";

const FILTERS = [
  { id: "", label: "Alle" },
  { id: "due", label: "Bald fällig" },
  { id: "expired", label: "Abgelaufen" },
] as const;

const SORTS = [
  { id: "bestBefore", label: "Nach Haltbarkeit" },
  { id: "storedAt", label: "Zuletzt eingelegt" },
  { id: "name", label: "Nach Name" },
] as const;

export function ApplianceView() {
  const { id } = useParams();
  const { openAdd } = useUi();
  const appliances = useAppliances();
  const [filter, setFilter] = useState<string>("");
  const [sort, setSort] = useState<string>("bestBefore");
  const items = useItems({ applianceId: id, expiry: filter || undefined, sort });

  if (appliances.isLoading) return <Spinner />;
  const appliance = appliances.data?.find((a) => a.id === id);
  if (!appliance) return <ErrorNote error="Dieses Kühlgerät gibt es nicht (mehr)." />;

  const freezer = appliance.type === "freezer";
  const byCompartment = new Map<string | null, Item[]>();
  for (const it of items.data ?? []) {
    const k = it.compartmentId;
    byCompartment.set(k, [...(byCompartment.get(k) ?? []), it]);
  }
  const shelves = [
    ...appliance.compartments.map((c) => ({ id: c.id as string | null, name: c.name })),
    ...(byCompartment.has(null) ? [{ id: null, name: "Ohne Fach" }] : []),
  ];

  return (
    <div className="space-y-6">
      <Link to="/" className="-ml-1 inline-flex items-center gap-1 text-ink-soft hover:text-ink">
        <ChevronLeft className="size-5" /> Übersicht
      </Link>

      <header className={`relative rounded-[28px] p-5 pr-10 ${freezer ? "bg-ice" : "bg-steel-tint"}`}>
        <span className={`absolute top-1/2 right-4 h-12 w-2 -translate-y-1/2 rounded-full ${freezer ? "bg-ice-ink/25" : "bg-steel/25"}`} aria-hidden />
        <span className={`flex items-center gap-1.5 text-sm ${freezer ? "text-ice-ink" : "text-steel-dark"}`}>
          <ApplianceIcon type={appliance.type} className="size-4" />
          {freezer ? "Tiefkühler" : "Kühlschrank"}
          {appliance.location && ` · ${appliance.location}`}
        </span>
        <h1 className="mt-2">
          <span className="tape text-4xl">{appliance.name}</span>
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => openAdd({ applianceId: appliance.id })}>
            <Plus className="size-5" /> Einlegen
          </button>
          <Link to={`/einstellungen?geraet=${appliance.id}#geraete`} className="btn-quiet">
            <Settings2 className="size-4" /> Fächer bearbeiten
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
        <select className="input ml-auto w-auto min-h-9 py-1 text-sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sortierung">
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {items.isLoading ? (
        <Spinner />
      ) : items.data?.length === 0 ? (
        <div className="rounded-3xl bg-surface">
          <Empty title={filter ? "Alles im grünen Bereich" : "Gähnende Leere"}>
            {filter ? "Hier ist nichts, was bald weg muss." : "Tippe auf „Einlegen“, um den ersten Artikel hinzuzufügen."}
          </Empty>
        </div>
      ) : (
        <div className="space-y-5">
          {shelves.map((s) => {
            const list = byCompartment.get(s.id) ?? [];
            if (filter && list.length === 0) return null;
            return (
              <section key={s.id ?? "none"}>
                <div className="mb-1.5 flex items-center gap-2 px-1">
                  <h2 className="font-medium">{s.name}</h2>
                  <span className="text-sm text-ink-faint tabular-nums">{list.length}</span>
                  {s.id && (
                    <button
                      onClick={() => openAdd({ applianceId: appliance.id, compartmentId: s.id! })}
                      className="ml-auto grid size-9 place-items-center rounded-full text-ink-soft hover:bg-surface hover:text-steel"
                      aria-label={`In ${s.name} einlegen`}
                    >
                      <Plus className="size-5" />
                    </button>
                  )}
                </div>
                {/* Fach als Glasboden: unten eine kräftige Kante */}
                <div className={`overflow-hidden rounded-2xl border-b-4 bg-surface ${freezer ? "border-ice-ink/20" : "border-steel/20"}`}>
                  {list.length ? (
                    <div className="divide-y divide-line">
                      {list.map((i) => (
                        <ItemRow key={i.id} item={i} />
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-sm text-ink-faint">leer</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
