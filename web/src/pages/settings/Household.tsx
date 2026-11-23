import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, Eye, EyeOff, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, saveHouseholdSettings, queryClient, useCategories, useHouseholdSettings, useMe, useMeta } from "../../api";
import { ErrorNote, Sheet } from "../../components/common";
import type { Category } from "../../types";
import { useUi } from "../../ui";
import { Card, ColorPicker, Section, SettingRow, Stepper, refresh } from "./parts";

/* ---------------- Haushalt ---------------- */

export function HouseholdSection() {
  const me = useMe();
  const hs = useHouseholdSettings();
  const members = useQuery({
    queryKey: ["members"],
    queryFn: () => api.get<{ id: string; displayName: string; email: string }[]>("/api/household/members"),
  });
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useUi();
  useEffect(() => setName(me.data?.household.name ?? ""), [me.data?.household.name]);

  const rename = useMutation({
    mutationFn: () => api.patch("/api/household", { name }),
    onSuccess: () => {
      void refresh("me");
      toast({ message: "Haushaltsname gespeichert" });
    },
  });
  const regen = useMutation({
    mutationFn: () => api.post<{ inviteCode: string }>("/api/household/invite-code"),
    onSuccess: () => refresh("me"),
  });
  const code = me.data?.household.inviteCode ?? "";

  return (
    <Section id="haushalt" title="Haushalt" intro="Gilt für alle Mitglieder: sie sehen dieselben Kühlgeräte, Artikel, Kategorien und Vorlagen.">
      <Card className="divide-y divide-line">
        <form
          className="flex gap-2 px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            rename.mutate();
          }}
        >
          <label className="flex-1">
            <span className="field-label">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn-quiet self-end" disabled={!name.trim() || name === me.data?.household.name}>
            Speichern
          </button>
        </form>

        <div className="px-5 py-4">
          <span className="field-label">Einladungscode</span>
          <div className="flex flex-wrap items-center gap-2">
            <code className="tape px-4 py-1 font-sans text-2xl font-semibold tracking-[0.2em]">{code}</code>
            <button
              className="btn-quiet"
              onClick={async () => {
                await navigator.clipboard?.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Kopiert" : "Kopieren"}
            </button>
            <button className="btn-quiet" onClick={() => regen.mutate()} disabled={regen.isPending}>
              <RefreshCw className="size-4" /> Neuer Code
            </button>
          </div>
          <p className="mt-2 text-sm text-ink-soft">Wer sich mit diesem Code registriert, tritt deinem Haushalt bei. Ein neuer Code macht den alten ungültig.</p>
        </div>

        <div className="px-5 py-4">
          <span className="field-label">Mitglieder</span>
          <ul className="flex flex-wrap gap-2">
            {members.data?.map((m) => (
              <li key={m.id} className="chip" title={m.email}>
                {m.displayName}
              </li>
            ))}
          </ul>
        </div>

        {hs.data && (
          <SettingRow label="„Bald fällig“ ab" hint="So viele Tage vor dem MHD wird ein Artikel gelb markiert.">
            <Stepper
              label="Tage vor dem MHD"
              value={hs.data.expiringSoonDays}
              min={0}
              max={30}
              suffix=" T."
              onChange={(expiringSoonDays) => saveHouseholdSettings({ expiringSoonDays })}
            />
          </SettingRow>
        )}
      </Card>
    </Section>
  );
}

/* ---------------- Kategorien ---------------- */

export function CategoriesSection() {
  const all = useCategories({ includeHidden: true });
  const hs = useHouseholdSettings();
  const [edit, setEdit] = useState<Category | "new" | null>(null);
  const hidden = new Set(hs.data?.hiddenCategories ?? []);

  return (
    <Section id="kategorien" title="Kategorien" intro="Symbole und Farben anpassen, nicht benötigte ausblenden oder eigene anlegen. Die Farbe nutzt der erweiterte Modus für Farbblöcke.">
      <Card>
        <ul className="divide-y divide-line">
          {all.map((c) => {
            const off = hidden.has(c.id);
            return (
              <li key={c.id} className="flex items-center gap-3 px-5 py-2">
                <span className="grid size-9 place-items-center rounded-lg text-xl" style={{ background: `color-mix(in oklab, ${c.color} 45%, var(--surface))` }} aria-hidden>
                  {c.icon}
                </span>
                <span className={`min-w-0 flex-1 ${off ? "text-ink-faint line-through" : ""}`}>
                  {c.label}
                  {c.custom && <span className="ml-2 text-xs text-ink-soft">eigene</span>}
                </span>
                <button className="icon-btn size-9" onClick={() => setEdit(c)} aria-label={`${c.label} bearbeiten`}>
                  <Pencil className="size-4" />
                </button>
                {!c.custom && c.id !== "other" && (
                  <button
                    className="icon-btn size-9"
                    onClick={() =>
                      saveHouseholdSettings({
                        hiddenCategories: off ? [...hidden].filter((x) => x !== c.id) : [...hidden, c.id],
                      })
                    }
                    aria-label={off ? `${c.label} einblenden` : `${c.label} ausblenden`}
                    aria-pressed={off}
                  >
                    {off ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                )}
              </li>
            );
          })}
          <li>
            <button className="row-press flex w-full items-center gap-3 px-5 py-3 text-left font-medium text-steel" onClick={() => setEdit("new")}>
              <Plus className="size-5" /> Eigene Kategorie
            </button>
          </li>
        </ul>
      </Card>
      {edit && <CategoryEdit category={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </Section>
  );
}

function CategoryEdit({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const hs = useHouseholdSettings();
  const meta = useMeta();
  const original = meta.data?.categories.find((c) => c.id === category?.id);
  const [label, setLabel] = useState(category?.label ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [color, setColor] = useState<string | null>(category?.color ?? "#5F7A80");
  const [error, setError] = useState<unknown>(null);

  async function save() {
    setError(null);
    try {
      const s = hs.data!;
      if (!category) {
        await api.post("/api/settings/household/categories", { label: label.trim(), icon: icon.trim(), color });
        await queryClient.invalidateQueries({ queryKey: ["settings", "household"] });
      } else if (category.custom) {
        await saveHouseholdSettings({
          customCategories: s.customCategories.map((c) => (c.id === category.id ? { ...c, label: label.trim(), icon: icon.trim(), color: color ?? c.color } : c)),
        });
      } else {
        // Standardkategorie: nur Symbol/Farbe überschreiben
        await saveHouseholdSettings({
          categoryOverrides: { ...s.categoryOverrides, [category.id]: { icon: icon.trim() || undefined, color: color ?? undefined } },
        });
      }
      onClose();
    } catch (e) {
      setError(e);
    }
  }

  async function remove() {
    const s = hs.data!;
    try {
      if (category?.custom) await saveHouseholdSettings({ customCategories: s.customCategories.filter((c) => c.id !== category.id) });
      else if (category) {
        const rest = { ...s.categoryOverrides };
        delete rest[category.id];
        await saveHouseholdSettings({ categoryOverrides: rest });
      }
      onClose();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Sheet
      title={category ? `${category.label} bearbeiten` : "Eigene Kategorie"}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-2">
          {category ? (
            <button className="btn-quiet text-expired" onClick={remove} aria-label={category.custom ? "Kategorie löschen" : "Auf Standard zurücksetzen"}>
              {category.custom ? <Trash2 className="size-5" /> : <X className="size-5" />}
            </button>
          ) : (
            <span />
          )}
          <button className="btn-primary" disabled={!label.trim() || !icon.trim()} onClick={save}>
            {category ? "Änderungen speichern" : "Kategorie anlegen"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <label>
            <span className="field-label">Name</span>
            <input className="input" value={label} disabled={!!category && !category.custom} onChange={(e) => setLabel(e.target.value)} autoFocus={!category} />
          </label>
          <label>
            <span className="field-label">Symbol</span>
            <input className="input text-center text-xl" value={icon} maxLength={8} placeholder={original?.icon ?? "🍼"} onChange={(e) => setIcon(e.target.value)} />
          </label>
        </div>
        <div>
          <span className="field-label">Farbe</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        {category?.custom && <p className="text-sm text-ink-soft">Wird die Kategorie gelöscht, zeigen Artikel mit dieser Kategorie ein neutrales Symbol.</p>}
        {category && !category.custom && <p className="text-sm text-ink-soft">Standardkategorien behalten ihren Namen. Das ✕ setzt Symbol und Farbe zurück.</p>}
        <ErrorNote error={error} />
      </div>
    </Sheet>
  );
}

/* ---------------- Einheiten ---------------- */

export function UnitsSection() {
  const meta = useMeta();
  const hs = useHouseholdSettings();
  const [unit, setUnit] = useState("");
  const extra = hs.data?.extraUnits ?? [];
  return (
    <Section id="einheiten" title="Einheiten" intro="Zusätzliche Einheiten für die Mengenangabe.">
      <Card className="space-y-3 px-5 py-4">
        <ul className="flex flex-wrap gap-2">
          {meta.data?.units.map((u) => (
            <li key={u} className="chip text-ink-soft">
              {u}
            </li>
          ))}
          {extra.map((u) => (
            <li key={u} className="chip pr-1">
              {u}
              <button
                className="icon-btn size-7"
                aria-label={`${u} entfernen`}
                onClick={() => saveHouseholdSettings({ extraUnits: extra.filter((x) => x !== u) })}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const u = unit.trim();
            if (!u || extra.includes(u) || meta.data?.units.includes(u)) return;
            void saveHouseholdSettings({ extraUnits: [...extra, u] }).then(() => setUnit(""));
          }}
        >
          <input className="input" placeholder="z. B. Glas, Becher, Bund" value={unit} maxLength={20} onChange={(e) => setUnit(e.target.value)} />
          <button className="btn-quiet" disabled={!unit.trim()}>
            <Plus className="size-4" /> Hinzufügen
          </button>
        </form>
      </Card>
    </Section>
  );
}
