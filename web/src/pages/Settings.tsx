import { LogOut, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, queryClient, useCategories, useMe, useMeta, usePresets, useUnits, useUserSettings } from "../api";
import { ErrorNote, Sheet, useCategoryIcon } from "../components/common";
import { SIZE_PRESETS } from "../lib/grid";
import type { Me, Preset } from "../types";
import { AppliancesSection } from "./settings/Appliances";
import { CategoriesSection, HouseholdSection, UnitsSection } from "./settings/Household";
import { Card, Section, refresh } from "./settings/parts";
import { ExtendedSection, HomeSection, PersonalSection } from "./settings/Personal";

const NAV = [
  { id: "darstellung", label: "Darstellung" },
  { id: "startseite", label: "Startseite" },
  { id: "erweitert", label: "Erweiterter Modus" },
  { id: "haushalt", label: "Haushalt" },
  { id: "geraete", label: "Kühlgeräte" },
  { id: "kategorien", label: "Kategorien" },
  { id: "einheiten", label: "Einheiten" },
  { id: "vorlagen", label: "Vorlagen" },
  { id: "konto", label: "Konto" },
];

export function Settings() {
  useEffect(() => {
    // Zu Abschnitt springen (z. B. #geraete)
    const id = window.location.hash.slice(1);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 80);
  }, []);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Einstellungen</h1>
        <nav aria-label="Bereiche" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="chip shrink-0 hover:border-steel hover:text-steel">
              {n.label}
            </a>
          ))}
        </nav>
      </div>
      <PersonalSection />
      <HomeSection />
      <ExtendedSection />
      <HouseholdSection />
      <AppliancesSection />
      <CategoriesSection />
      <UnitsSection />
      <PresetsSection />
      <AccountSection />
    </div>
  );
}

/* ---------------- Vorlagen ---------------- */

function PresetsSection() {
  const presets = usePresets();
  const iconFor = useCategoryIcon();
  const [edit, setEdit] = useState<Preset | "new" | null>(null);
  const own = presets.data?.filter((p) => !p.global) ?? [];
  const globalCount = (presets.data?.length ?? 0) - own.length;

  return (
    <Section
      id="vorlagen"
      title="Eigene Vorlagen"
      intro={`Vorlagen füllen beim Einlegen Name, Menge, Haltbarkeit und Größe im Raster vor. Dazu gibt es ${globalCount} Standard-Vorlagen.`}
    >
      <Card className="divide-y divide-line overflow-hidden">
        {own.map((p) => (
          <button key={p.id} className="row-press flex w-full items-center gap-3 px-5 py-3 text-left" onClick={() => setEdit(p)}>
            <span className="text-2xl" aria-hidden>
              {iconFor(p.category, p.icon)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{p.name}</span>
              <span className="block text-sm text-ink-soft">
                {[
                  p.shelfLifeFridgeDays != null && `Kühlschrank ${p.shelfLifeFridgeDays} T.`,
                  p.shelfLifeFreezerDays != null && `Tiefkühler ${p.shelfLifeFreezerDays} T.`,
                  p.gridW && `${p.gridW}×${p.gridH ?? 1} Felder`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "ohne Haltbarkeit"}
              </span>
            </span>
            <Pencil className="size-4 text-ink-faint" />
          </button>
        ))}
        <button className="row-press flex w-full items-center gap-3 px-5 py-3 text-left font-medium text-steel" onClick={() => setEdit("new")}>
          <Plus className="size-5" /> Vorlage anlegen
        </button>
      </Card>
      {edit && <PresetEdit preset={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </Section>
  );
}

function PresetEdit({ preset, onClose }: { preset: Preset | null; onClose: () => void }) {
  const categories = useCategories({ includeHidden: true });
  const units = useUnits();
  const extended = useUserSettings().data?.mode === "extended";
  const [f, setF] = useState({
    name: preset?.name ?? "",
    icon: preset?.icon ?? "",
    category: preset?.category ?? "other",
    defaultQuantity: preset?.defaultQuantity?.toString() ?? "",
    defaultUnit: preset?.defaultUnit ?? "",
    shelfLifeFridgeDays: preset?.shelfLifeFridgeDays?.toString() ?? "",
    shelfLifeFreezerDays: preset?.shelfLifeFreezerDays?.toString() ?? "",
  });
  const [size, setSize] = useState<{ w: number; h: number } | null>(preset?.gridW ? { w: preset.gridW, h: preset.gridH ?? 1 } : null);
  const [error, setError] = useState<unknown>(null);
  const num = (s: string) => (s.trim() ? Number(s.replace(",", ".")) : null);

  async function save() {
    setError(null);
    const body = {
      name: f.name.trim(),
      icon: f.icon.trim() || null,
      category: f.category,
      defaultQuantity: num(f.defaultQuantity),
      defaultUnit: f.defaultUnit.trim() || null,
      shelfLifeFridgeDays: num(f.shelfLifeFridgeDays),
      shelfLifeFreezerDays: num(f.shelfLifeFreezerDays),
      gridW: size?.w ?? null,
      gridH: size?.h ?? null,
    };
    try {
      if (preset) await api.patch(`/api/presets/${preset.id}`, body);
      else await api.post("/api/presets", body);
      await refresh("presets");
      onClose();
    } catch (e) {
      setError(e);
    }
  }
  async function remove() {
    try {
      await api.del(`/api/presets/${preset!.id}`);
      await refresh("presets");
      onClose();
    } catch (e) {
      setError(e);
    }
  }

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <input className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
    </label>
  );

  return (
    <Sheet
      title={preset ? "Vorlage bearbeiten" : "Vorlage anlegen"}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-2">
          {preset ? (
            <button className="btn-quiet text-expired" onClick={remove} aria-label="Vorlage löschen">
              <Trash2 className="size-5" />
            </button>
          ) : (
            <span />
          )}
          <button className="btn-primary" disabled={!f.name.trim()} onClick={save}>
            Vorlage speichern
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          {field("name", "Name", { autoFocus: true })}
          {field("icon", "Symbol", { maxLength: 8, className: "input text-center text-xl" })}
        </div>
        <label className="block">
          <span className="field-label">Kategorie</span>
          <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {field("defaultQuantity", "Standardmenge", { inputMode: "decimal" })}
          {field("defaultUnit", "Einheit", { list: "units-preset" })}
          <datalist id="units-preset">
            {units.map((u) => <option key={u} value={u} />)}
          </datalist>
        </div>
        <fieldset>
          <legend className="field-label">Haltbarkeit in Tagen</legend>
          <div className="grid grid-cols-2 gap-3">
            {field("shelfLifeFridgeDays", "im Kühlschrank", { inputMode: "numeric" })}
            {field("shelfLifeFreezerDays", "im Tiefkühler", { inputMode: "numeric" })}
          </div>
        </fieldset>
        {(extended || size) && (
          <fieldset>
            <legend className="field-label">Größe im Raster (erweiterter Modus)</legend>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="chip min-h-8 px-2.5" aria-pressed={size === null} onClick={() => setSize(null)}>
                Standard (1×1)
              </button>
              {SIZE_PRESETS.slice(1).map((s) => (
                <button key={s.label} type="button" className="chip min-h-8 px-2.5" aria-pressed={size?.w === s.w && size?.h === s.h} onClick={() => setSize({ w: s.w, h: s.h })}>
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <ErrorNote error={error} />
      </div>
    </Sheet>
  );
}

/* ---------------- Konto ---------------- */

function AccountSection() {
  const me = useMe();
  const meta = useMeta();
  return (
    <Section id="konto" title="Konto">
      <Card className="flex flex-wrap items-center gap-3 p-5">
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{me.data?.user.displayName}</span>
          <span className="block truncate text-sm text-ink-soft">{me.data?.user.email}</span>
        </span>
        <button
          className="btn-quiet"
          onClick={async () => {
            await api.post("/api/auth/logout");
            queryClient.setQueryData<Me | undefined>(["me"], undefined);
            queryClient.clear();
            window.location.href = "/";
          }}
        >
          <LogOut className="size-4" /> Abmelden
        </button>
      </Card>
      {meta.data?.version && <p className="mt-6 text-center text-sm text-ink-faint">PFS Version {meta.data.version}</p>}
    </Section>
  );
}
