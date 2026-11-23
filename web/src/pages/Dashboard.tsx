import { Plus, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import { useAppliances, useItems, useMe } from "../api";
import { ApplianceDoor } from "../components/ApplianceDoor";
import { Empty, ItemRow, Spinner } from "../components/common";

export function Dashboard() {
  const me = useMe();
  const appliances = useAppliances();
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim());
  const due = useItems({ expiry: "due" });
  const results = useItems({ q: query || undefined, limit: "50" });

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
            <Spinner />
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
        <>
          {due.data && due.data.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold">Muss bald weg</h2>
              <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
                {due.data.slice(0, 8).map((i) => (
                  <ItemRow key={i.id} item={i} showLocation />
                ))}
              </div>
              {due.data.length > 8 && <p className="mt-2 text-sm text-ink-soft">und {due.data.length - 8} weitere</p>}
            </section>
          )}

          <section>
            <h2 className="mb-3 font-semibold">Kühlgeräte</h2>
            {appliances.isLoading ? (
              <Spinner />
            ) : appliances.data?.length === 0 ? (
              <div className="rounded-3xl bg-surface">
                <Empty title="Noch leer hier">
                  <p className="mb-4">Lege deinen ersten Kühlschrank oder Tiefkühler an. Fächer werden automatisch vorgeschlagen.</p>
                  <Link to="/einstellungen#geraete" className="btn-primary">
                    Kühlgerät anlegen
                  </Link>
                </Empty>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 md:gap-4">
                {appliances.data?.map((a) => (
                  <ApplianceDoor key={a.id} appliance={a} />
                ))}
                <Link
                  to="/einstellungen#geraete"
                  className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-[28px] border-2 border-dashed border-line text-ink-soft transition-colors hover:border-steel hover:text-steel"
                >
                  <Plus className="size-7" />
                  Gerät hinzufügen
                </Link>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
