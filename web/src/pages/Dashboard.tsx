import { AlertTriangle, ChevronRight, Clock, Package, Plus, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import { useAppliances, useItems, useMe, useStats, useUserSettings } from "../api";
import { ApplianceDoor } from "../components/ApplianceDoor";
import { DoorSkeleton, Empty, ItemRow, ListSkeleton } from "../components/common";
import type { HomeSectionId } from "../types";

const DEFAULT_HOME: { id: HomeSectionId; visible: boolean }[] = [
  { id: "due", visible: true },
  { id: "appliances", visible: true },
  { id: "recent", visible: true },
  { id: "stats", visible: false },
];

export function Dashboard() {
  const me = useMe();
  const settings = useUserSettings();
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim());
  const results = useItems({ q: query || undefined, limit: "50" });
  const sections = (settings.data?.home ?? DEFAULT_HOME).filter((s) => s.visible);

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold md:text-3xl">Hallo {me.data?.user.displayName}</h1>
        <label className="relative block">
          <span className="sr-only">In allen Kühlgeräten suchen</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-faint" />
          <input className="input pl-10" placeholder="Wo ist noch …?" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </label>
      </header>

      {query ? (
        <section>
          <h2 className="mb-2 font-semibold">Suchergebnisse</h2>
          {results.isLoading ? (
            <ListSkeleton rows={3} />
          ) : results.data?.length ? (
            <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
              {results.data.map((i) => (
                <ItemRow key={i.id} item={i} showLocation />
              ))}
            </div>
          ) : (
            <p className="text-ink-soft">Nichts gefunden zu „{query}“.</p>
          )}
        </section>
      ) : (
        sections.map((s) => {
          switch (s.id) {
            case "due":
              return <DueSection key={s.id} />;
            case "appliances":
              return <AppliancesSection key={s.id} />;
            case "recent":
              return <RecentSection key={s.id} />;
            case "stats":
              return <StatsSection key={s.id} />;
          }
        })
      )}
    </div>
  );
}

function DueSection() {
  const due = useItems({ expiry: "due" });
  if (due.isLoading)
    return (
      <section>
        <h2 className="mb-2 font-semibold">Muss bald weg</h2>
        <ListSkeleton rows={2} />
      </section>
    );
  if (!due.data?.length) return null;
  return (
    <section>
      <h2 className="mb-2 font-semibold">Muss bald weg</h2>
      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
        {due.data.slice(0, 8).map((i) => (
          <ItemRow key={i.id} item={i} showLocation />
        ))}
      </div>
      {due.data.length > 8 && <p className="mt-2 text-sm text-ink-soft">und {due.data.length - 8} weitere</p>}
    </section>
  );
}

function AppliancesSection() {
  const appliances = useAppliances();
  return (
    <section>
      <h2 className="mb-3 font-semibold">Kühlgeräte</h2>
      {appliances.data?.length === 0 ? (
        <div className="rounded-3xl bg-surface">
          <Empty title="Noch leer hier">
            <p className="mb-4">Lege deinen ersten Kühlschrank oder Tiefkühler an. Fächer werden automatisch vorgeschlagen.</p>
            <Link to="/einstellungen#geraete" className="btn-primary">
              Kühlgerät anlegen
            </Link>
          </Empty>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {appliances.isLoading ? <DoorSkeleton /> : appliances.data?.map((a) => <ApplianceDoor key={a.id} appliance={a} />)}
          {!appliances.isLoading && (
            <Link
              to="/einstellungen#geraete"
              className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-[28px] border-2 border-dashed border-line text-ink-soft transition-colors hover:border-steel hover:bg-steel-tint/30 hover:text-steel"
            >
              <Plus className="size-7" />
              Gerät hinzufügen
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function RecentSection() {
  const recent = useItems({ sort: "storedAt", limit: "5" });
  if (!recent.isLoading && !recent.data?.length) return null;
  return (
    <section>
      <h2 className="mb-2 font-semibold">Zuletzt eingelegt</h2>
      {recent.isLoading ? (
        <ListSkeleton rows={3} />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
          {recent.data!.map((i) => (
            <ItemRow key={i.id} item={i} showLocation />
          ))}
        </div>
      )}
    </section>
  );
}

function StatsSection() {
  const stats = useStats();
  const t = stats.data?.totals;
  const tiles = [
    { icon: <Package className="size-4 text-steel" />, value: t?.active, label: "im Bestand" },
    { icon: <Clock className="size-4 text-soon" />, value: t?.expiringSoon, label: "bald fällig" },
    { icon: <AlertTriangle className="size-4 text-expired" />, value: t?.expired, label: "abgelaufen" },
  ];
  return (
    <section>
      <Link to="/statistik" className="mb-2 inline-flex items-center gap-1 font-semibold transition-colors hover:text-steel">
        Kurzstatistik <ChevronRight className="size-4" />
      </Link>
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((x) => (
          <div key={x.label} className="rounded-2xl bg-surface p-3">
            {x.icon}
            <div className="mt-1 text-2xl font-semibold tabular-nums">{x.value ?? "–"}</div>
            <div className="text-sm text-ink-soft">{x.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
