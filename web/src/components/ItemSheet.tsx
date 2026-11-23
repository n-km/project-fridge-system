import { ArchiveRestore, Camera, MapPin, PackageMinus, Pencil, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { api, invalidateInventory, photoUrl, queryClient, uploadPhoto, useAppliances, useCategories, useItem, useMeta, useUnits, useUserSettings } from "../api";
import { PlacementEditor } from "./extended/PlacementPicker";
import { formatDate, formatQuantity, relativeDays } from "../lib/dates";
import type { Item, RemovalReason } from "../types";
import { useUi, type ItemMode } from "../ui";
import { ApplianceIcon, ErrorNote, ExpiryBadge, Sheet, Spinner, useCategoryIcon, useCategoryInfo } from "./common";

export function ItemSheet() {
  const { itemId, itemMode, closeItem } = useUi();
  if (!itemId) return null;
  return <ItemSheetInner key={itemId + itemMode} id={itemId} initialMode={itemMode} onClose={closeItem} />;
}

function ItemSheetInner({ id, initialMode, onClose }: { id: string; initialMode: ItemMode; onClose: () => void }) {
  const item = useItem(id);
  const [mode, setMode] = useState<ItemMode>(initialMode);
  // Direkt aus einer Wischgeste geöffnet → Zurück schließt das Sheet
  const back = () => (initialMode === "view" ? setMode("view") : onClose());

  if (item.isLoading) {
    return (
      <Sheet title="Artikel" onClose={onClose}>
        <Spinner />
      </Sheet>
    );
  }
  if (!item.data) {
    return (
      <Sheet title="Artikel" onClose={onClose}>
        <ErrorNote error={item.error ?? "Artikel nicht gefunden"} />
      </Sheet>
    );
  }
  const it = item.data;
  if (mode === "remove" && it.status === "active") return <RemoveView item={it} onBack={back} onDone={onClose} />;
  if (mode === "edit" && it.status === "active") return <EditView item={it} onBack={back} />;
  return <DetailView item={it} onClose={onClose} onRemove={() => setMode("remove")} onEdit={() => setMode("edit")} />;
}

/* ---------------- Ansicht ---------------- */

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 py-2.5">
      <dt className="w-32 shrink-0 text-ink-soft">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function DetailView({ item, onClose, onRemove, onEdit }: { item: Item; onClose: () => void; onRemove: () => void; onEdit: () => void }) {
  const iconFor = useCategoryIcon();
  const categoryInfo = useCategoryInfo();
  const meta = useMeta();
  const appliances = useAppliances();
  const settings = useUserSettings();
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [restoreTo, setRestoreTo] = useState("");
  const archived = item.status === "archived";
  const reason = meta.data?.removalReasons.find((r) => r.id === item.removalReason);
  const category = categoryInfo(item.category);
  const compartment = appliances.data?.flatMap((a) => a.compartments).find((c) => c.id === item.compartmentId);

  async function restore() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/items/${item.id}/restore`, item.applianceId ? {} : { applianceId: restoreTo });
      await invalidateInventory();
      toast({ message: `${item.name} ist wieder im ${item.applianceName ?? "Kühlgerät"}` });
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    setBusy(true);
    try {
      await api.del(`/api/items/${item.id}`);
      // Erst schließen und Cache entfernen, sonst wird der gelöschte Artikel nachgeladen (404)
      onClose();
      queryClient.removeQueries({ queryKey: ["item", item.id] });
      await invalidateInventory();
      toast({ message: `${item.name} endgültig gelöscht` });
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  const footer = archived ? (
    confirmDelete ? (
      <div className="space-y-2">
        <p className="text-sm">Endgültig löschen? Das lässt sich nicht rückgängig machen.</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-quiet" onClick={() => setConfirmDelete(false)}>
            Abbrechen
          </button>
          <button className="btn-danger" disabled={busy} onClick={destroy}>
            Endgültig löschen
          </button>
        </div>
      </div>
    ) : (
      <div className="space-y-2">
        {!item.applianceId && (
          <select className="input" value={restoreTo} onChange={(e) => setRestoreTo(e.target.value)} aria-label="Kühlgerät zum Zurücklegen">
            <option value="">Kühlgerät wählen …</option>
            {appliances.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button className="btn-primary" disabled={busy || (!item.applianceId && !restoreTo)} onClick={restore}>
            <ArchiveRestore className="size-5" /> Zurücklegen
          </button>
          <button className="btn-quiet text-expired" onClick={() => setConfirmDelete(true)} aria-label="Endgültig löschen">
            <Trash2 className="size-5" />
          </button>
        </div>
      </div>
    )
  ) : (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <button className="btn-primary" onClick={onRemove}>
        <PackageMinus className="size-5" /> Entnehmen
      </button>
      <button className="btn-quiet" onClick={onEdit}>
        <Pencil className="size-4" /> Bearbeiten
      </button>
    </div>
  );

  return (
    <Sheet title={item.name} onClose={onClose} footer={footer}>
      {item.photoId ? (
        <a href={photoUrl(item.photoId, "full")} target="_blank" rel="noreferrer" className="mb-4 block">
          <img src={photoUrl(item.photoId, "full")} alt={`Foto: ${item.name}`} className="max-h-72 w-full rounded-2xl bg-frost object-cover" />
        </a>
      ) : (
        <div className="mb-4 grid h-28 place-items-center rounded-2xl bg-frost text-6xl" aria-hidden>
          {iconFor(item.category, item.icon)}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {archived ? (
          <span className="rounded-full bg-frost-deep px-2.5 py-0.5 text-sm">
            {reason?.icon} {reason?.label ?? "Entnommen"} {item.removedAt && `· ${relativeDays(item.removedAt)}`}
          </span>
        ) : (
          <ExpiryBadge bestBefore={item.bestBefore} />
        )}
        {category && (
          <span className="text-sm text-ink-soft">
            {category.icon} {category.label}
          </span>
        )}
      </div>

      <dl className="divide-y divide-line">
        <Row label="Ort">
          <span className="flex items-center gap-1.5">
            <ApplianceIcon type={item.applianceType} className="size-4 text-ink-soft" />
            {item.applianceName ?? <em className="text-ink-faint">Gerät gelöscht</em>}
            {item.compartmentName && `, ${item.compartmentName}`}
          </span>
          {item.position && (
            <span className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
              <MapPin className="size-3.5" /> {item.position}
            </span>
          )}
        </Row>
        {(item.quantity != null || item.unit) && <Row label="Menge">{formatQuantity(item.quantity, item.unit)}</Row>}
        <Row label={item.applianceType === "freezer" ? "Eingefroren" : "Eingelegt"}>
          {formatDate(item.storedAt)} <span className="text-ink-soft">({relativeDays(item.storedAt)})</span>
        </Row>
        <Row label="Haltbar bis">{item.bestBefore ? formatDate(item.bestBefore) : <span className="text-ink-faint">nicht angegeben</span>}</Row>
        {item.note && <Row label="Notiz">{item.note}</Row>}
      </dl>
      {!archived && settings.data?.mode === "extended" && compartment && (
        <section className="mt-4 rounded-2xl bg-frost p-3">
          <h3 className="mb-2 text-sm font-medium text-ink-soft">Platz im Fach „{compartment.name}“</h3>
          <PlacementEditor item={item} compartment={compartment} />
        </section>
      )}
      <div className="mt-3">
        <ErrorNote error={error} />
      </div>
    </Sheet>
  );
}

/* ---------------- Entnehmen ---------------- */

const REASON_STYLE: Record<RemovalReason, string> = {
  consumed: "border-fresh/40 bg-fresh-tint",
  discarded: "border-expired/40 bg-expired-tint",
  given_away: "border-given/30 bg-ice",
  other: "border-line bg-frost",
};

function RemoveView({ item, onBack, onDone }: { item: Item; onBack: () => void; onDone: () => void }) {
  const meta = useMeta();
  const { toast } = useUi();
  const canSplit = item.quantity != null && item.quantity > 0;
  const [amount, setAmount] = useState(canSplit ? String(item.quantity) : "");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const parsed = Number(amount.replace(",", "."));
  const partialValid = !canSplit || (parsed > 0 && parsed <= item.quantity!);

  async function remove(reason: RemovalReason) {
    setBusy(true);
    setError(null);
    try {
      const qty = canSplit && parsed < item.quantity! ? parsed : undefined;
      const res = await api.post<{ archivedId: string; partial: boolean; remainingQuantity: number | null }>(`/api/items/${item.id}/remove`, {
        reason,
        quantity: qty,
      });
      await invalidateInventory();
      const label = meta.data?.removalReasons.find((r) => r.id === reason)?.label ?? "Entnommen";
      toast({
        message: res.partial
          ? `${formatQuantity(qty!, item.unit)} ${item.name} entnommen – noch ${formatQuantity(res.remainingQuantity, item.unit)}`
          : `${item.name}: ${label}`,
        action: {
          label: "Rückgängig",
          run: async () => {
            await api.post(`/api/items/${res.archivedId}/restore`, res.partial ? { mergeIntoId: item.id } : {});
            await invalidateInventory();
          },
        },
      });
      onDone();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <Sheet title={`${item.name} entnehmen`} onClose={onBack}>
      {canSplit && (
        <div className="mb-5">
          <label className="field-label" htmlFor="r-amt">
            Wie viel? (vorhanden: {formatQuantity(item.quantity, item.unit)})
          </label>
          <div className="flex items-center gap-2">
            <input id="r-amt" className="input max-w-40" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} />
            <span className="text-ink-soft">{item.unit}</span>
            <button type="button" className="chip ml-auto" onClick={() => setAmount(String(item.quantity))}>
              Alles
            </button>
          </div>
          {!partialValid && <p className="mt-1 text-sm text-expired">Bitte eine Menge zwischen 0 und {item.quantity} angeben.</p>}
        </div>
      )}
      <p className="field-label">Was ist damit passiert?</p>
      <div className="grid grid-cols-2 gap-3">
        {meta.data?.removalReasons.map((r) => (
          <button
            key={r.id}
            disabled={busy || !partialValid}
            onClick={() => remove(r.id)}
            className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-3 py-4 font-medium transition hover:brightness-95 disabled:opacity-50 ${REASON_STYLE[r.id]}`}
          >
            <span className="text-3xl" aria-hidden>
              {r.icon}
            </span>
            {r.label}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-soft">Der Artikel landet im Archiv und kann von dort zurückgelegt werden.</p>
      <div className="mt-3">
        <ErrorNote error={error} />
      </div>
    </Sheet>
  );
}

/* ---------------- Bearbeiten / Umlagern ---------------- */

function EditView({ item, onBack }: { item: Item; onBack: () => void }) {
  // Auch ausgeblendete Kategorien, damit die aktuelle Kategorie des Artikels auswählbar bleibt
  const categories = useCategories({ includeHidden: true });
  const units = useUnits();
  const appliances = useAppliances();
  const { toast } = useUi();
  const [f, setF] = useState({
    name: item.name,
    icon: item.icon ?? "",
    category: item.category,
    applianceId: item.applianceId ?? "",
    compartmentId: item.compartmentId ?? "",
    position: item.position ?? "",
    quantity: item.quantity != null ? String(item.quantity) : "",
    unit: item.unit ?? "",
    bestBefore: item.bestBefore ?? "",
    note: item.note ?? "",
    photoId: item.photoId,
  });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const appliance = appliances.data?.find((a) => a.id === f.applianceId);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/items/${item.id}`, {
        name: f.name.trim(),
        icon: f.icon.trim() || null,
        category: f.category,
        ...(f.applianceId ? { applianceId: f.applianceId } : {}),
        compartmentId: f.compartmentId || null,
        position: f.position.trim() || null,
        quantity: f.quantity ? Number(f.quantity.replace(",", ".")) : null,
        unit: f.unit.trim() || null,
        bestBefore: f.bestBefore || null,
        note: f.note.trim() || null,
        photoId: f.photoId,
      });
      await invalidateInventory();
      toast({ message: "Änderungen gespeichert" });
      onBack();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      title="Artikel bearbeiten"
      onClose={onBack}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-quiet" onClick={onBack}>
            Abbrechen
          </button>
          <button className="btn-primary" disabled={busy || !f.name.trim()} onClick={save}>
            Änderungen speichern
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {f.photoId && <img src={photoUrl(f.photoId)} alt="" className="size-16 rounded-xl object-cover" />}
          <label className="btn-quiet cursor-pointer">
            <Camera className="size-5" /> {f.photoId ? "Foto ersetzen" : "Foto aufnehmen"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  set({ photoId: await uploadPhoto(file) });
                } catch (err) {
                  setError(err);
                }
              }}
            />
          </label>
          {f.photoId && (
            <button className="text-sm text-expired" onClick={() => set({ photoId: null })}>
              Foto entfernen
            </button>
          )}
        </div>
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <label>
            <span className="field-label">Name</span>
            <input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label>
            <span className="field-label">Symbol</span>
            <input className="input text-center text-xl" value={f.icon} maxLength={8} onChange={(e) => set({ icon: e.target.value })} />
          </label>
        </div>
        <label className="block">
          <span className="field-label">Kategorie</span>
          <select className="input" value={f.category} onChange={(e) => set({ category: e.target.value })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="field-label">Kühlgerät</span>
            <select className="input" value={f.applianceId} onChange={(e) => set({ applianceId: e.target.value, compartmentId: "" })}>
              {appliances.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Fach</span>
            <select className="input" value={f.compartmentId} onChange={(e) => set({ compartmentId: e.target.value })}>
              <option value="">– kein Fach –</option>
              {appliance?.compartments.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="field-label">Genauer Platz</span>
          <input className="input" value={f.position} onChange={(e) => set({ position: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="field-label">Menge</span>
            <input className="input" inputMode="decimal" value={f.quantity} onChange={(e) => set({ quantity: e.target.value.replace(/[^\d.,]/g, "") })} />
          </label>
          <label>
            <span className="field-label">Einheit</span>
            <input className="input" list="units-edit" value={f.unit} onChange={(e) => set({ unit: e.target.value })} />
            <datalist id="units-edit">
              {units.map((u) => <option key={u} value={u} />)}
            </datalist>
          </label>
        </div>
        <label className="block">
          <span className="field-label">Mindestens haltbar bis</span>
          <input type="date" className="input" value={f.bestBefore} onChange={(e) => set({ bestBefore: e.target.value })} />
        </label>
        <label className="block">
          <span className="field-label">Notiz</span>
          <textarea className="input min-h-20 py-2" value={f.note} onChange={(e) => set({ note: e.target.value })} />
        </label>
        <ErrorNote error={error} />
      </div>
    </Sheet>
  );
}
