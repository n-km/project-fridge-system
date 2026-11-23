import { useMutation } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, useAppliances, useMeta, useUserSettings } from "../../api";
import { ApplianceIcon, ErrorNote, Sheet } from "../../components/common";
import { Surface } from "../../components/extended/Surface";
import type { Appliance, ApplianceTemplate, ApplianceType, Compartment, CompartmentKind, CompartmentSpec } from "../../types";
import { useUi } from "../../ui";
import { Card, ColorPicker, Section, Segmented, Stepper, refresh } from "./parts";

const KIND_ICON: Record<CompartmentKind, string> = { shelf: "▭", drawer: "▤", door: "▯", basket: "🧺", bottle: "🍾" };

export function AppliancesSection() {
  const appliances = useAppliances();
  const [params, setParams] = useSearchParams();
  const editId = params.get("geraet");
  const [creating, setCreating] = useState(false);
  const editing = appliances.data?.find((a) => a.id === editId);

  return (
    <Section id="geraete" title="Kühlgeräte" intro="Baue deine Geräte so nach, wie sie wirklich aufgebaut sind – mit Fächern, Schubladen, Türfächern und Körben.">
      <Card className="divide-y divide-line overflow-hidden">
        {appliances.data?.map((a) => (
          <button key={a.id} className="row-press flex w-full items-center gap-3 px-5 py-3 text-left" onClick={() => setParams({ geraet: a.id })}>
            <span
              className={`grid size-10 place-items-center rounded-xl ${a.type === "freezer" ? "bg-ice text-ice-ink" : "bg-steel-tint text-steel-dark"}`}
              style={a.color ? { background: `color-mix(in oklab, ${a.color} 30%, var(--surface))` } : undefined}
            >
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
        <button className="row-press flex w-full items-center gap-3 px-5 py-3 text-left font-medium text-steel" onClick={() => setCreating(true)}>
          <span className="grid size-10 place-items-center rounded-xl border-2 border-dashed border-steel/40">
            <Plus className="size-5" />
          </span>
          Kühlgerät hinzufügen
        </button>
      </Card>
      {creating && <ApplianceCreate onClose={() => setCreating(false)} />}
      {editing && <ApplianceEdit appliance={editing} onClose={() => setParams({}, { replace: true })} />}
    </Section>
  );
}

/* ---------------- Schema-Bild einer Vorlage ---------------- */

function Schematic({ t }: { t: Pick<ApplianceTemplate, "layout" | "type"> & { compartments: Pick<CompartmentSpec, "kind" | "height" | "zone">[] } }) {
  const body = t.compartments.filter((c) => c.kind !== "door");
  const doors = t.compartments.filter((c) => c.kind === "door");
  const freezerish = (c: { zone?: ApplianceType | null }) => (c.zone ?? t.type) === "freezer";
  if (t.layout === "chest")
    return (
      <div className="flex h-14 w-20 flex-wrap gap-0.5 rounded-md border-2 border-ink-faint/40 bg-ice p-1" aria-hidden>
        {t.compartments.map((c, i) => (
          <span key={i} className={`rounded-sm ${c.kind === "basket" ? "h-5 flex-1 border border-ice-ink/40" : "h-5 w-full bg-ice-ink/15"}`} />
        ))}
      </div>
    );
  return (
    <div className="flex h-20 w-14 gap-0.5 rounded-md border-2 border-ink-faint/40 bg-surface p-1" aria-hidden>
      <div className="flex flex-1 flex-col gap-0.5">
        {body.map((c, i) => (
          <span
            key={i}
            className={`rounded-sm ${c.kind === "drawer" ? "border border-ink-faint/50" : "border-b-2 border-ink-faint/40"} ${freezerish(c) ? "bg-ice-ink/20" : "bg-steel/10"}`}
            style={{ flex: c.height }}
          />
        ))}
      </div>
      {doors.length > 0 && (
        <div className="flex w-2 flex-col justify-around">
          {doors.map((_, i) => (
            <span key={i} className="h-1.5 rounded-sm bg-ink-faint/40" />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Anlegen ---------------- */

function ApplianceCreate({ onClose }: { onClose: () => void }) {
  const meta = useMeta();
  const { toast } = useUi();
  const templates = meta.data?.applianceTemplates ?? [];
  const [template, setTemplate] = useState("fridge");
  const [f, setF] = useState({ name: "", location: "" });
  const t = templates.find((x) => x.id === template);
  const m = useMutation({
    mutationFn: () => api.post<Appliance>("/api/appliances", { ...f, location: f.location || null, template }),
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
      wide
      footer={
        <button className="btn-primary w-full" disabled={!f.name.trim() || m.isPending} onClick={() => m.mutate()}>
          Kühlgerät anlegen
        </button>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="field-label">Bauform</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {templates.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={x.id === template}
                onClick={() => setTemplate(x.id)}
                className="lift flex flex-col items-center gap-2 rounded-2xl border-2 border-line bg-surface p-3 text-sm aria-pressed:border-steel aria-pressed:bg-steel-tint/50"
              >
                <Schematic t={x} />
                <span className="font-medium">{x.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Name</span>
            <input className="input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t?.type === "freezer" ? "z. B. Truhe" : "z. B. Küche"} />
          </label>
          <label className="block">
            <span className="field-label">Standort (optional)</span>
            <input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="z. B. Keller" />
          </label>
        </div>
        {t && (
          <p className="text-sm text-ink-soft">
            Fächer: {t.compartments.map((c) => c.name).join(", ")}. Alles lässt sich danach ändern.
          </p>
        )}
        <ErrorNote error={m.error} />
      </div>
    </Sheet>
  );
}

/* ---------------- Bearbeiten ---------------- */

function ApplianceEdit({ appliance, onClose }: { appliance: Appliance; onClose: () => void }) {
  const { toast } = useUi();
  const meta = useMeta();
  const settings = useUserSettings();
  const [f, setF] = useState({ name: appliance.name, location: appliance.location ?? "", type: appliance.type, layout: appliance.layout, color: appliance.color });
  const [newComp, setNewComp] = useState({ name: "", kind: (appliance.type === "freezer" ? "drawer" : "shelf") as CompartmentKind });
  const [openComp, setOpenComp] = useState<string | null>(null);
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
  const comps = appliance.compartments;
  const move = (i: number, d: -1 | 1) => {
    const ids = comps.map((c) => c.id);
    [ids[i], ids[i + d]] = [ids[i + d]!, ids[i]!];
    void run(() => api.put(`/api/appliances/${appliance.id}/compartments/order`, { ids }));
  };

  return (
    <Sheet
      title="Kühlgerät bearbeiten"
      onClose={onClose}
      wide
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
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <Schematic t={{ layout: f.layout, type: f.type, compartments: comps }} />
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <label>
              <span className="field-label">Name</span>
              <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </label>
            <label>
              <span className="field-label">Standort</span>
              <input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div>
            <span className="field-label">Art</span>
            <Segmented
              label="Art"
              value={f.type}
              onChange={(type) => setF({ ...f, type })}
              options={[
                { id: "fridge", label: "Kühlschrank" },
                { id: "freezer", label: "Tiefkühler" },
              ]}
            />
          </div>
          <div>
            <span className="field-label">Bauform</span>
            <Segmented
              label="Bauform"
              value={f.layout}
              onChange={(layout) => setF({ ...f, layout })}
              options={[
                { id: "upright", label: "Stehend" },
                { id: "chest", label: "Truhe" },
              ]}
            />
          </div>
        </div>
        <div>
          <span className="field-label">Farbe der Tür</span>
          <ColorPicker value={f.color} onChange={(color) => setF({ ...f, color })} allowNone />
        </div>

        <div>
          <span className="field-label">Fächer</span>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {comps.map((c, i) => (
              <li key={c.id}>
                <div className="flex items-center gap-1 py-1 pr-1 pl-3">
                  <button
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => setOpenComp(openComp === c.id ? null : c.id)}
                    aria-expanded={openComp === c.id}
                  >
                    <span className="w-6 text-center" aria-hidden>
                      {KIND_ICON[c.kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block text-xs text-ink-soft">
                        {meta.data?.compartmentKinds.find((k) => k.id === c.kind)?.label} · {c.gridCols}×{c.gridRows} · bis {c.maxStack} übereinander
                        {c.zone && c.zone !== appliance.type && ` · ${c.zone === "freezer" ? "Gefrierbereich" : "Kühlbereich"}`}
                      </span>
                    </span>
                    <ChevronDown className={`size-4 shrink-0 text-ink-soft transition-transform ${openComp === c.id ? "rotate-180" : ""}`} />
                  </button>
                  <button className="icon-btn size-9" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`${c.name} nach oben`}>
                    <ArrowUp className="size-4" />
                  </button>
                  <button className="icon-btn size-9" disabled={i === comps.length - 1} onClick={() => move(i, 1)} aria-label={`${c.name} nach unten`}>
                    <ArrowDown className="size-4" />
                  </button>
                </div>
                {openComp === c.id && (
                  <CompartmentEditor
                    c={c}
                    applianceType={appliance.type}
                    showGrid={settings.data?.mode === "extended"}
                    onChange={(patch) => run(() => api.patch(`/api/compartments/${c.id}`, patch))}
                    onDelete={() => run(() => api.del(`/api/compartments/${c.id}`))}
                  />
                )}
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newComp.name.trim()) return;
              void run(() => api.post(`/api/appliances/${appliance.id}/compartments`, { name: newComp.name.trim(), kind: newComp.kind })).then(() =>
                setNewComp({ ...newComp, name: "" }),
              );
            }}
          >
            <input className="input min-w-40 flex-1" placeholder="Neues Fach, z. B. Eierfach" value={newComp.name} onChange={(e) => setNewComp({ ...newComp, name: e.target.value })} />
            <select className="input w-auto" value={newComp.kind} onChange={(e) => setNewComp({ ...newComp, kind: e.target.value as CompartmentKind })} aria-label="Art des Fachs">
              {meta.data?.compartmentKinds.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            <button className="btn-quiet" disabled={!newComp.name.trim()}>
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

function CompartmentEditor({
  c,
  applianceType,
  showGrid,
  onChange,
  onDelete,
}: {
  c: Compartment;
  applianceType: ApplianceType;
  showGrid: boolean;
  onChange: (patch: Partial<Compartment>) => void;
  onDelete: () => void;
}) {
  const meta = useMeta();
  const [name, setName] = useState(c.name);
  return (
    <div className="space-y-4 border-t border-line bg-frost/60 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className="field-label">Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== c.name && onChange({ name: name.trim() })} />
        </label>
        <label>
          <span className="field-label">Art</span>
          <select className="input" value={c.kind} onChange={(e) => onChange({ kind: e.target.value as CompartmentKind })}>
            {meta.data?.compartmentKinds.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Bereich</span>
          <select
            className="input"
            value={c.zone ?? ""}
            onChange={(e) => onChange({ zone: (e.target.value || null) as ApplianceType | null })}
          >
            <option value="">Wie das Gerät ({applianceType === "freezer" ? "Tiefkühler" : "Kühlschrank"})</option>
            <option value="fridge">Kühlbereich</option>
            <option value="freezer">Gefrierbereich</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <div>
          <span className="field-label">Breite (Felder)</span>
          <Stepper label="Breite" value={c.gridCols} min={1} max={12} onChange={(gridCols) => onChange({ gridCols })} />
        </div>
        <div>
          <span className="field-label">Tiefe (Felder)</span>
          <Stepper label="Tiefe" value={c.gridRows} min={1} max={8} onChange={(gridRows) => onChange({ gridRows })} />
        </div>
        <div>
          <span className="field-label">Übereinander</span>
          <Stepper label="Stapelhöhe" value={c.maxStack} min={1} max={6} onChange={(maxStack) => onChange({ maxStack })} />
        </div>
        <div>
          <span className="field-label">Höhe</span>
          <Stepper label="Höhe" value={c.height} min={1} max={4} onChange={(height) => onChange({ height })} />
        </div>
      </div>
      {showGrid && (
        <div className="overflow-x-auto">
          <Surface compartment={c} placed={[]} cell={22} opts={{ tileStyle: "icon", showNames: false, showExpiry: false }} tint={(c.zone ?? applianceType) === "freezer" ? "freezer" : "fridge"} />
        </div>
      )}
      <p className="text-xs text-ink-soft">Wird das Raster verkleinert, kommen Artikel außerhalb in die Ablage „Noch nicht platziert“.</p>
      <button className="btn-quiet min-h-9 text-sm text-expired" onClick={onDelete}>
        <Trash2 className="size-4" /> Fach löschen
      </button>
    </div>
  );
}
