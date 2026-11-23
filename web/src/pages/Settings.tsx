import { useMutation } from "@tanstack/react-query";
import { Check, Copy, LogOut, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, queryClient, useAppliances, useMe, useMeta, usePresets } from "../api";
import { ApplianceIcon, ErrorNote, Sheet, useCategoryIcon } from "../components/common";
import type { Appliance, ApplianceType, Me, Preset } from "../types";
import { useUi } from "../ui";

const refresh = (...keys: string[]) => Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: [k] })));

export function Settings() {
  useEffect(() => {
    // Zu Abschnitt springen (z. B. #geraete)
    const id = window.location.hash.slice(1);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 50);
  }, []);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold md:text-3xl">Einstellungen</h1>
      <HouseholdSection />
      <AppliancesSection />
      <PresetsSection />
      <AccountSection />
    </div>
  );
}

function Section({ id, title, intro, children }: { id?: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-lg font-semibold">{title}</h2>
      {intro && <p className="mt-0.5 mb-3 max-w-prose text-ink-soft">{intro}</p>}
      <div className={intro ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

/* ---------------- Haushalt ---------------- */

function HouseholdSection() {
  const me = useMe();
  const members = useQueryMembers();
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
    <Section title="Haushalt" intro="Alle im Haushalt sehen dieselben Kühlgeräte und Artikel.">
      <div className="space-y-5 rounded-3xl bg-surface p-5">
        <form
          className="flex gap-2"
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

        <div>
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

        <div>
          <span className="field-label">Mitglieder</span>
          <ul className="flex flex-wrap gap-2">
            {members.data?.map((m) => (
              <li key={m.id} className="chip" title={m.email}>
                {m.displayName}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

function useQueryMembers() {
  const [data, setData] = useState<{ id: string; displayName: string; email: string }[]>();
  useEffect(() => {
    api.get<typeof data>("/api/household/members").then(setData).catch(() => {});
  }, []);
  return { data };
}

/* ---------------- Kühlgeräte & Fächer ---------------- */

function AppliancesSection() {
  const appliances = useAppliances();
  const [params, setParams] = useSearchParams();
  const editId = params.get("geraet");
  const [creating, setCreating] = useState(false);
  const editing = appliances.data?.find((a) => a.id === editId);

  return (
    <Section id="geraete" title="Kühlgeräte" intro="Benenne Geräte nach Standort, z. B. „Küche“ oder „Truhe im Keller“.">
      <div className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
        {appliances.data?.map((a) => (
          <button key={a.id} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-frost/70" onClick={() => setParams({ geraet: a.id })}>
            <span className={`grid size-10 place-items-center rounded-xl ${a.type === "freezer" ? "bg-ice text-ice-ink" : "bg-steel-tint text-steel-dark"}`}>
              <ApplianceIcon type={a.type} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{a.name}</span>
              <span className="block truncate text-sm text-ink-soft">
                {[a.location, `${a.compartments.length} Fächer`, `${a.counts?.active ?? 0} Artikel`].filter(Boolean).join(" · ")}
              </span>
            </span>
            <Pencil className="size-4 text-ink-faint" />
          </button>
        ))}
        <button className="flex w-full items-center gap-3 px-5 py-3 text-left font-medium text-steel hover:bg-frost/70" onClick={() => setCreating(true)}>
          <span className="grid size-10 place-items-center rounded-xl border-2 border-dashed border-steel/40">
            <Plus className="size-5" />
          </span>
          Kühlgerät hinzufügen
        </button>
      </div>
      {creating && <ApplianceCreate onClose={() => setCreating(false)} />}
      {editing && <ApplianceEdit appliance={editing} onClose={() => setParams({}, { replace: true })} />}
    </Section>
  );
}

function TypePicker({ value, onChange }: { value: ApplianceType; onChange: (t: ApplianceType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["fridge", "freezer"] as const).map((t) => (
        <button key={t} type="button" className="chip justify-center py-2" aria-pressed={value === t} onClick={() => onChange(t)}>
          <ApplianceIcon type={t} className="size-4" /> {t === "fridge" ? "Kühlschrank" : "Tiefkühler"}
        </button>
      ))}
    </div>
  );
}

function ApplianceCreate({ onClose }: { onClose: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ name: "", location: "", type: "fridge" as ApplianceType });
  const m = useMutation({
    mutationFn: () => api.post<Appliance>("/api/appliances", { ...f, location: f.location || null }),
    onSuccess: async (a) => {
      await refresh("appliances");
      toast({ message: `${a.name} angelegt – Fächer kannst du jederzeit anpassen` });
      onClose();
    },
  });
  return (
    <Sheet
      title="Kühlgerät hinzufügen"
      onClose={onClose}
      footer={
        <button className="btn-primary w-full" disabled={!f.name.trim() || m.isPending} onClick={() => m.mutate()}>
          Kühlgerät anlegen
        </button>
      }
    >
      <div className="space-y-4">
        <TypePicker value={f.type} onChange={(type) => setF({ ...f, type })} />
        <label className="block">
          <span className="field-label">Name</span>
          <input className="input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={f.type === "fridge" ? "z. B. Küche" : "z. B. Truhe"} />
        </label>
        <label className="block">
          <span className="field-label">Standort (optional)</span>
          <input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="z. B. Keller" />
        </label>
        <p className="text-sm text-ink-soft">
          Fächer werden vorgeschlagen ({f.type === "fridge" ? "oben, Mitte, unten, Gemüsefach, Tür" : "Schublade 1–3"}) und lassen sich danach ändern.
        </p>
        <ErrorNote error={m.error} />
      </div>
    </Sheet>
  );
}

function ApplianceEdit({ appliance, onClose }: { appliance: Appliance; onClose: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ name: appliance.name, location: appliance.location ?? "", type: appliance.type });
  const [newComp, setNewComp] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await refresh("appliances", "items");
    } catch (e) {
      setError(e);
    }
  };

  return (
    <Sheet
      title="Kühlgerät bearbeiten"
      onClose={onClose}
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button className="btn-quiet text-expired" onClick={() => setConfirmDelete(true)} aria-label="Kühlgerät löschen">
            <Trash2 className="size-5" />
          </button>
          <button
            className="btn-primary"
            disabled={!f.name.trim()}
            onClick={() =>
              run(async () => {
                await api.patch(`/api/appliances/${appliance.id}`, { ...f, location: f.location || null });
                toast({ message: "Änderungen gespeichert" });
                onClose();
              })
            }
          >
            Änderungen speichern
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <TypePicker value={f.type} onChange={(type) => setF({ ...f, type })} />
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="field-label">Name</span>
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </label>
          <label>
            <span className="field-label">Standort</span>
            <input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
          </label>
        </div>

        <div>
          <span className="field-label">Fächer</span>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {appliance.compartments.map((c) => (
              <CompartmentRow
                key={c.id}
                name={c.name}
                onRename={(name) => run(() => api.patch(`/api/compartments/${c.id}`, { name }))}
                onDelete={() => run(() => api.del(`/api/compartments/${c.id}`))}
              />
            ))}
          </ul>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newComp.trim()) return;
              void run(() => api.post(`/api/appliances/${appliance.id}/compartments`, { name: newComp.trim() })).then(() => setNewComp(""));
            }}
          >
            <input className="input" placeholder="Neues Fach, z. B. Eierfach" value={newComp} onChange={(e) => setNewComp(e.target.value)} />
            <button className="btn-quiet" disabled={!newComp.trim()}>
              <Plus className="size-4" /> Hinzufügen
            </button>
          </form>
          <p className="mt-1 text-sm text-ink-soft">Wird ein Fach gelöscht, bleiben seine Artikel im Gerät – nur ohne Fach.</p>
        </div>

        {confirmDelete && (
          <div className="space-y-2 rounded-2xl bg-expired-tint p-3">
            <p className="text-sm">
              <strong>{appliance.name}</strong> löschen? Das geht nur, wenn nichts mehr darin liegt. Archivierte Artikel bleiben erhalten.
            </p>
            <div className="flex gap-2">
              <button className="btn-quiet" onClick={() => setConfirmDelete(false)}>
                Abbrechen
              </button>
              <button
                className="btn-danger"
                onClick={() =>
                  run(async () => {
                    await api.del(`/api/appliances/${appliance.id}`);
                    toast({ message: `${appliance.name} gelöscht` });
                    onClose();
                  })
                }
              >
                Kühlgerät löschen
              </button>
            </div>
          </div>
        )}
        <ErrorNote error={error} />
      </div>
    </Sheet>
  );
}

function CompartmentRow({ name, onRename, onDelete }: { name: string; onRename: (n: string) => void; onDelete: () => void }) {
  const [value, setValue] = useState(name);
  useEffect(() => setValue(name), [name]);
  return (
    <li className="flex items-center gap-1 pr-1 pl-3">
      <input
        className="min-h-11 flex-1 bg-transparent focus:outline-none"
        value={value}
        aria-label="Name des Fachs"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value.trim() && value !== name && onRename(value.trim())}
      />
      <button className="grid size-10 place-items-center rounded-full text-ink-faint hover:bg-expired-tint hover:text-expired" onClick={onDelete} aria-label={`Fach ${name} löschen`}>
        <Trash2 className="size-4" />
      </button>
    </li>
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
      intro={`Vorlagen füllen beim Einlegen Name, Menge und Haltbarkeit vor. Dazu gibt es ${globalCount} Standard-Vorlagen.`}
    >
      <div className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
        {own.map((p) => (
          <button key={p.id} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-frost/70" onClick={() => setEdit(p)}>
            <span className="text-2xl" aria-hidden>
              {iconFor(p.category, p.icon)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{p.name}</span>
              <span className="block text-sm text-ink-soft">
                {[p.shelfLifeFridgeDays != null && `Kühlschrank ${p.shelfLifeFridgeDays} T.`, p.shelfLifeFreezerDays != null && `Tiefkühler ${p.shelfLifeFreezerDays} T.`]
                  .filter(Boolean)
                  .join(" · ") || "ohne Haltbarkeit"}
              </span>
            </span>
            <Pencil className="size-4 text-ink-faint" />
          </button>
        ))}
        <button className="flex w-full items-center gap-3 px-5 py-3 text-left font-medium text-steel hover:bg-frost/70" onClick={() => setEdit("new")}>
          <Plus className="size-5" /> Vorlage anlegen
        </button>
      </div>
      {edit && <PresetEdit preset={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </Section>
  );
}

function PresetEdit({ preset, onClose }: { preset: Preset | null; onClose: () => void }) {
  const meta = useMeta();
  const [f, setF] = useState({
    name: preset?.name ?? "",
    icon: preset?.icon ?? "",
    category: preset?.category ?? "other",
    defaultQuantity: preset?.defaultQuantity?.toString() ?? "",
    defaultUnit: preset?.defaultUnit ?? "",
    shelfLifeFridgeDays: preset?.shelfLifeFridgeDays?.toString() ?? "",
    shelfLifeFreezerDays: preset?.shelfLifeFreezerDays?.toString() ?? "",
  });
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
            {meta.data?.categories.map((c) => (
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
            {meta.data?.units.map((u) => <option key={u} value={u} />)}
          </datalist>
        </div>
        <fieldset>
          <legend className="field-label">Haltbarkeit in Tagen</legend>
          <div className="grid grid-cols-2 gap-3">
            {field("shelfLifeFridgeDays", "im Kühlschrank", { inputMode: "numeric" })}
            {field("shelfLifeFreezerDays", "im Tiefkühler", { inputMode: "numeric" })}
          </div>
        </fieldset>
        <ErrorNote error={error} />
      </div>
    </Sheet>
  );
}

/* ---------------- Konto ---------------- */

function AccountSection() {
  const me = useMe();
  return (
    <Section title="Konto">
      <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-surface p-5">
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
      </div>
    </Section>
  );
}
