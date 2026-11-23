import { Camera, ChevronLeft, ImagePlus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  invalidateInventory,
  photoUrl,
  queryClient,
  uploadPhoto,
  useAppliances,
  useCategories,
  useItems,
  usePresets,
  useUnits,
  useUserSettings,
} from "../api";
import { addDaysIso, todayIso } from "../lib/dates";
import type { Appliance, Compartment, Item, Preset } from "../types";
import { useUi } from "../ui";
import { ApplianceIcon, ErrorNote, Sheet, Spinner, useCategoryIcon } from "./common";
import { PlacementField, type PlacementChoice } from "./extended/PlacementPicker";

export function AddItemSheet() {
  const { addOpen, closeAdd } = useUi();
  if (!addOpen) return null;
  return <AddItemInner ctx={addOpen} onClose={closeAdd} />;
}

function AddItemInner({ ctx, onClose }: { ctx: { applianceId?: string; compartmentId?: string }; onClose: () => void }) {
  const [step, setStep] = useState<"pick" | "details">("pick");
  const [preset, setPreset] = useState<Preset | null>(null);
  const [typedName, setTypedName] = useState("");
  const appliances = useAppliances();

  if (appliances.data && appliances.data.length === 0) {
    return (
      <Sheet title="Artikel einlegen" onClose={onClose}>
        <p className="mb-4 text-ink-soft">Lege zuerst einen Kühlschrank oder Tiefkühler an, dann kannst du Artikel einlegen.</p>
        <Link to="/einstellungen#geraete" className="btn-primary" onClick={onClose}>
          Kühlgerät anlegen
        </Link>
      </Sheet>
    );
  }

  if (step === "pick") {
    return (
      <PresetPicker
        onClose={onClose}
        onPick={(p, typed) => {
          setPreset(p);
          setTypedName(typed ?? "");
          setStep("details");
        }}
      />
    );
  }
  return (
    <ItemForm
      preset={preset}
      typedName={typedName}
      ctx={ctx}
      appliances={appliances.data ?? []}
      onBack={() => setStep("pick")}
      onClose={onClose}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Schritt 1: Vorlage wählen                                           */
/* ------------------------------------------------------------------ */

function PresetPicker({ onPick, onClose }: { onPick: (p: Preset | null, typed?: string) => void; onClose: () => void }) {
  const presets = usePresets();
  const recent = useItems({ sort: "storedAt", limit: "40" });
  const iconFor = useCategoryIcon();
  const [q, setQ] = useState("");

  const recentPresets = useMemo(() => {
    const ids = [...new Set((recent.data ?? []).map((i) => i.presetId).filter(Boolean))];
    return ids
      .map((id) => presets.data?.find((p) => p.id === id))
      .filter((p): p is Preset => !!p)
      .slice(0, 6);
  }, [recent.data, presets.data]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = presets.data ?? [];
    return s ? list.filter((p) => p.name.toLowerCase().includes(s)) : list;
  }, [q, presets.data]);

  const tile = (p: Preset) => (
    <button
      key={p.id}
      onClick={() => onPick(p)}
      className="lift flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface px-2 py-3 text-center hover:border-steel"
    >
      {p.photoId ? (
        <img src={photoUrl(p.photoId)} alt="" className="size-10 rounded-lg object-cover" />
      ) : (
        <span className="text-3xl leading-10" aria-hidden>
          {iconFor(p.category, p.icon)}
        </span>
      )}
      <span className="line-clamp-2 text-sm leading-tight">{p.name}</span>
    </button>
  );

  return (
    <Sheet title="Was legst du ein?" onClose={onClose} wide>
      <label className="relative mb-4 block">
        <span className="sr-only">Vorlage suchen</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-faint" />
        <input
          autoFocus
          className="input pl-10"
          placeholder="Suchen, z. B. Milch"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      <button
        onClick={() => onPick(null, q.trim())}
        className="mb-5 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-line px-4 py-3 text-left hover:border-steel"
      >
        <span className="text-2xl" aria-hidden>
          ✏️
        </span>
        <span>
          <span className="block font-medium">{q ? `„${q}“ ohne Vorlage einlegen` : "Ohne Vorlage einlegen"}</span>
          <span className="block text-sm text-ink-soft">Alles selbst eintragen</span>
        </span>
      </button>

      {presets.isLoading && <Spinner />}

      {!q && recentPresets.length > 0 && (
        <section className="mb-5">
          <h3 className="mb-2 text-sm font-medium text-ink-soft">Zuletzt eingelegt</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{recentPresets.map(tile)}</div>
        </section>
      )}

      <section>
        {!q && <h3 className="mb-2 text-sm font-medium text-ink-soft">Alle Vorlagen</h3>}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">{filtered.map(tile)}</div>
        {q && filtered.length === 0 && <p className="py-4 text-center text-ink-soft">Keine Vorlage gefunden.</p>}
      </section>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Schritt 2: Details                                                  */
/* ------------------------------------------------------------------ */

const QUICK_MHD = [
  { label: "+3 Tage", days: 3 },
  { label: "+1 Woche", days: 7 },
  { label: "+1 Monat", days: 30 },
  { label: "+3 Monate", days: 90 },
];

function suggestMhd(preset: Preset | null, appliance: Appliance | undefined, compartment: Compartment | undefined, storedOn: string) {
  if (!preset || !appliance) return "";
  // Gefrierfach in einer Kühl-Gefrier-Kombi zählt als Tiefkühler
  const zone = compartment?.zone ?? appliance.type;
  const d = zone === "freezer" ? preset.shelfLifeFreezerDays : preset.shelfLifeFridgeDays;
  return d != null ? addDaysIso(storedOn, d) : "";
}

function ItemForm({
  preset,
  typedName,
  ctx,
  appliances,
  onBack,
  onClose,
}: {
  preset: Preset | null;
  typedName: string;
  ctx: { applianceId?: string; compartmentId?: string };
  appliances: Appliance[];
  onBack: () => void;
  onClose: () => void;
}) {
  const categories = useCategories();
  const units = useUnits();
  const settings = useUserSettings();
  const extended = settings.data?.mode === "extended";
  const { toast } = useUi();
  const iconFor = useCategoryIcon();

  const lastAppliance = localStorageGet("pfs:lastAppliance");
  const initialAppliance =
    appliances.find((a) => a.id === ctx.applianceId) ??
    appliances.find((a) => a.id === settings.data?.defaultApplianceId) ??
    appliances.find((a) => a.id === lastAppliance) ??
    appliances[0];

  const [name, setName] = useState(preset?.name ?? typedName);
  const [category, setCategory] = useState(preset?.category ?? "other");
  const [icon, setIcon] = useState(preset?.icon ?? "");
  const [applianceId, setApplianceId] = useState(initialAppliance?.id ?? "");
  const [compartmentId, setCompartmentId] = useState(ctx.compartmentId ?? "");
  const [position, setPosition] = useState("");
  const [quantity, setQuantity] = useState(preset?.defaultQuantity != null ? String(preset.defaultQuantity) : "");
  const [unit, setUnit] = useState(preset?.defaultUnit ?? "");
  const [storedOn, setStoredOn] = useState(todayIso());
  const [bestBefore, setBestBefore] = useState(() =>
    suggestMhd(preset, initialAppliance, initialAppliance?.compartments.find((c) => c.id === ctx.compartmentId), todayIso()),
  );
  const [gridSize, setGridSize] = useState({ w: preset?.gridW ?? 1, h: preset?.gridH ?? 1 });
  const [placement, setPlacement] = useState<PlacementChoice>("auto");
  const [bbTouched, setBbTouched] = useState(false);
  const [note, setNote] = useState("");
  const [photoId, setPhotoId] = useState<string | null>(preset?.photoId ?? null);
  const [uploading, setUploading] = useState(false);
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const appliance = appliances.find((a) => a.id === applianceId);
  const compartment = appliance?.compartments.find((c) => c.id === compartmentId);

  // Vorschlag nachziehen, wenn Gerät, Fach oder Datum wechselt – solange nicht von Hand geändert
  useEffect(() => {
    if (!bbTouched) setBestBefore(suggestMhd(preset, appliance, compartment, storedOn));
  }, [applianceId, compartmentId, storedOn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (appliance && compartmentId && !appliance.compartments.some((c) => c.id === compartmentId)) setCompartmentId("");
  }, [applianceId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setPhotoId(await uploadPhoto(file));
    } catch (e) {
      setError(e);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const storedAt = storedOn === todayIso() ? new Date() : new Date(`${storedOn}T12:00:00`);
      const item = await api.post<Item>("/api/items", {
        applianceId,
        compartmentId: compartmentId || null,
        presetId: preset?.id ?? null,
        name: name.trim(),
        category,
        icon: icon.trim() || null,
        quantity: quantity ? Number(quantity.replace(",", ".")) : null,
        unit: unit.trim() || null,
        position: position.trim() || null,
        note: note.trim() || null,
        storedAt: storedAt.toISOString(),
        bestBefore: bestBefore || null,
        photoId,
        ...(extended && compartment && placement === "auto" ? { autoPlace: true, gridW: gridSize.w, gridH: gridSize.h } : {}),
        ...(extended && compartment && placement && placement !== "auto"
          ? { gridX: placement.x, gridY: placement.y, gridW: gridSize.w, gridH: gridSize.h }
          : {}),
      });
      if (saveAsPreset && !preset) {
        const days = bestBefore ? Math.max(0, Math.round((+new Date(bestBefore) - +new Date(storedOn)) / 86_400_000)) : null;
        await api.post("/api/presets", {
          name: item.name,
          category,
          icon: icon.trim() || null,
          defaultQuantity: item.quantity,
          defaultUnit: item.unit,
          [(compartment?.zone ?? appliance?.type) === "freezer" ? "shelfLifeFreezerDays" : "shelfLifeFridgeDays"]: days,
          photoId,
          ...(extended ? { gridW: gridSize.w, gridH: gridSize.h } : {}),
        });
        await queryClient.invalidateQueries({ queryKey: ["presets"] });
      }
      localStorageSet("pfs:lastAppliance", applianceId);
      await invalidateInventory();
      toast({ message: `${item.name} eingelegt` });
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }

  const valid = name.trim().length > 0 && applianceId && !uploading;

  return (
    <Sheet
      onClose={onClose}
      wide
      title={
        <span className="flex items-center gap-1">
          <button onClick={onBack} className="-ml-2 grid size-10 place-items-center rounded-full hover:bg-frost" aria-label="Zurück zur Vorlagenauswahl">
            <ChevronLeft className="size-5" />
          </button>
          {preset ? preset.name : "Neuer Artikel"}
        </span>
      }
      footer={
        <button className="btn-primary w-full" disabled={!valid || saving} onClick={save}>
          {saving ? "Wird eingelegt …" : "Einlegen"}
        </button>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) void save();
        }}
      >
        {/* Foto */}
        <div className="flex items-center gap-4">
          {photoId ? (
            <div className="relative">
              <img src={photoUrl(photoId)} alt="Foto des Artikels" className="size-24 rounded-2xl object-cover" />
              <button
                type="button"
                onClick={() => setPhotoId(null)}
                className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full bg-surface text-expired shadow"
                aria-label="Foto entfernen"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ) : (
            <span className="grid size-24 place-items-center rounded-2xl bg-frost text-5xl" aria-hidden>
              {iconFor(category, icon)}
            </span>
          )}
          <div className="flex flex-col gap-2">
            <label className="btn-quiet cursor-pointer">
              <Camera className="size-5" />
              {uploading ? "Lädt hoch …" : photoId ? "Neues Foto" : "Foto aufnehmen"}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
            <label className="cursor-pointer text-sm text-steel underline-offset-2 hover:underline">
              <ImagePlus className="mr-1 inline size-4" />
              Aus Galerie wählen
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
          </div>
        </div>

        {/* Name & Kategorie */}
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <div>
            <label className="field-label" htmlFor="f-name">
              Name
            </label>
            <input id="f-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus={!preset} />
          </div>
          <div>
            <label className="field-label" htmlFor="f-icon">
              Symbol
            </label>
            <input id="f-icon" className="input text-center text-xl" value={icon} maxLength={8} placeholder={iconFor(category)} onChange={(e) => setIcon(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="f-cat">
            Kategorie
          </label>
          <select id="f-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Ort */}
        <fieldset>
          <legend className="field-label">Wohin?</legend>
          <div className="flex flex-wrap gap-2">
            {appliances.map((a) => (
              <button type="button" key={a.id} className="chip" aria-pressed={a.id === applianceId} onClick={() => setApplianceId(a.id)}>
                <ApplianceIcon type={a.type} className="size-4" />
                {a.name}
              </button>
            ))}
          </div>
          {appliance && appliance.compartments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Fach">
              {appliance.compartments.map((c) => (
                <button type="button" key={c.id} className="chip" aria-pressed={c.id === compartmentId} onClick={() => setCompartmentId(c.id === compartmentId ? "" : c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <input className="input mt-3" placeholder="Genauer Platz (optional), z. B. hinten links" value={position} onChange={(e) => setPosition(e.target.value)} />
        </fieldset>

        {extended && compartment && (
          <fieldset className="rounded-2xl bg-frost p-3">
            <legend className="sr-only">Platz im Fach</legend>
            <p className="field-label">Platz in „{compartment.name}“</p>
            <PlacementField
              compartment={compartment}
              size={gridSize}
              onSize={(w, h) => setGridSize({ w, h })}
              value={placement}
              onChange={setPlacement}
            />
          </fieldset>
        )}

        {/* Menge */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="f-qty">
              Menge
            </label>
            <input id="f-qty" className="input" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^\d.,]/g, ""))} />
          </div>
          <div>
            <label className="field-label" htmlFor="f-unit">
              Einheit
            </label>
            <input id="f-unit" className="input" list="units" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <datalist id="units">
              {units.map((u) => <option key={u} value={u} />)}
            </datalist>
          </div>
        </div>

        {/* Daten */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="f-stored">
              {(compartment?.zone ?? appliance?.type) === "freezer" ? "Eingefroren am" : "Eingelegt am"}
            </label>
            <input id="f-stored" type="date" className="input" value={storedOn} max={todayIso()} onChange={(e) => setStoredOn(e.target.value || todayIso())} />
          </div>
          <div>
            <label className="field-label" htmlFor="f-bb">
              Mindestens haltbar bis
            </label>
            <input
              id="f-bb"
              type="date"
              className="input"
              value={bestBefore}
              onChange={(e) => {
                setBbTouched(true);
                setBestBefore(e.target.value);
              }}
            />
          </div>
        </div>
        <div className="-mt-2 flex flex-wrap gap-2">
          {QUICK_MHD.map((q) => (
            <button
              type="button"
              key={q.label}
              className="chip"
              onClick={() => {
                setBbTouched(true);
                setBestBefore(addDaysIso(storedOn, q.days));
              }}
            >
              {q.label}
            </button>
          ))}
          <button
            type="button"
            className="chip"
            aria-pressed={!bestBefore}
            onClick={() => {
              setBbTouched(true);
              setBestBefore("");
            }}
          >
            Kein MHD
          </button>
        </div>

        <div>
          <label className="field-label" htmlFor="f-note">
            Notiz
          </label>
          <textarea id="f-note" className="input min-h-20 py-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. für Sonntag, schon angebrochen" />
        </div>

        {!preset && (
          <label className="flex items-center gap-3">
            <input type="checkbox" className="size-5 accent-steel" checked={saveAsPreset} onChange={(e) => setSaveAsPreset(e.target.checked)} />
            Als Vorlage speichern
          </label>
        )}

        <ErrorNote error={error} />
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

function localStorageGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function localStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* privat-Modus o. Ä. */
  }
}
