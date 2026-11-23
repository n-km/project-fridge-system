import { Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useItems, useMeta } from "../api";
import { Empty, ItemThumb, Spinner } from "../components/common";
import { formatDate, formatQuantity } from "../lib/dates";
import { useUi } from "../ui";

export function Archive() {
  const meta = useMeta();
  const { openItem } = useUi();
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(100);
  const query = useDeferredValue(q.trim());
  const items = useItems({ status: "archived", q: query || undefined, limit: String(limit) });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold md:text-3xl">Archiv</h1>
        <p className="mt-1 max-w-prose text-ink-soft">
          Alles, was entnommen wurde. Versehentlich entnommen? Artikel antippen und zurücklegen. Endgültig löschen geht nur von hier.
        </p>
      </header>

      <label className="relative block">
        <span className="sr-only">Archiv durchsuchen</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-faint" />
        <input className="input pl-10" type="search" placeholder="Im Archiv suchen" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      {items.isLoading ? (
        <Spinner />
      ) : !items.data?.length ? (
        <div className="rounded-3xl bg-surface">
          <Empty title={query ? "Nichts gefunden" : "Archiv ist leer"}>
            {query ? `Kein entnommener Artikel heißt „${query}“.` : "Entnommene Artikel erscheinen hier."}
          </Empty>
        </div>
      ) : (
        <>
          <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
            {items.data.map((i) => {
              const reason = meta.data?.removalReasons.find((r) => r.id === i.removalReason);
              return (
                <button key={i.id} onClick={() => openItem(i.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-frost/70">
                  <ItemThumb item={i} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{i.name}</span>
                    <span className="block truncate text-sm text-ink-soft">
                      {[formatQuantity(i.quantity, i.unit), i.applianceName ?? "Gerät gelöscht"].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <span className="block">
                      <span aria-hidden>{reason?.icon}</span> {reason?.label}
                    </span>
                    <span className="block text-ink-faint">{i.removedAt && formatDate(i.removedAt, true)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {items.data.length >= limit && (
            <button className="btn-quiet w-full" onClick={() => setLimit((l) => l + 100)}>
              Ältere laden
            </button>
          )}
        </>
      )}
    </div>
  );
}
