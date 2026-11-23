import { ArrowDown, ArrowUp, Box } from "lucide-react";
import { saveUserSettings, useAppliances, useCategories, useUserSettings } from "../../api";
import { Switch } from "../../components/common";
import { Surface } from "../../components/extended/Surface";
import type { Compartment, HomeSectionId, Item, UserSettings } from "../../types";
import { useUi } from "../../ui";
import { Card, Section, Segmented, SettingRow } from "./parts";

function useSave() {
  const { toast } = useUi();
  return (patch: Parameters<typeof saveUserSettings>[0]) =>
    saveUserSettings(patch).catch((e) => toast({ message: e instanceof Error ? e.message : "Speichern fehlgeschlagen", tone: "error" }));
}

/* ---------------- Darstellung ---------------- */

export function PersonalSection() {
  const s = useUserSettings().data;
  const appliances = useAppliances();
  const save = useSave();
  if (!s) return null;
  return (
    <Section id="darstellung" title="Darstellung" intro="Gilt nur für dich – andere im Haushalt behalten ihre eigenen Einstellungen.">
      <Card className="divide-y divide-line">
        <SettingRow label="Design">
          <Segmented
            label="Design"
            value={s.theme}
            onChange={(theme) => save({ theme })}
            options={[
              { id: "auto", label: "Automatisch" },
              { id: "light", label: "Hell" },
              { id: "dark", label: "Dunkel" },
            ]}
          />
        </SettingRow>
        <SettingRow label="Dichte" hint="Kompakt zeigt mehr Artikel auf einmal.">
          <Segmented
            label="Dichte"
            value={s.density}
            onChange={(density) => save({ density })}
            options={[
              { id: "comfortable", label: "Komfortabel" },
              { id: "compact", label: "Kompakt" },
            ]}
          />
        </SettingRow>
        <SettingRow label="Artikel zeigen mit">
          <Segmented
            label="Artikel zeigen mit"
            value={s.itemDisplay}
            onChange={(itemDisplay) => save({ itemDisplay })}
            options={[
              { id: "photo", label: "Foto" },
              { id: "icon", label: "Symbol" },
            ]}
          />
        </SettingRow>
        <SettingRow label="Animationen" hint="„Automatisch“ folgt der Systemeinstellung „Bewegung reduzieren“.">
          <Segmented
            label="Animationen"
            value={s.motion}
            onChange={(motion) => save({ motion })}
            options={[
              { id: "auto", label: "Automatisch" },
              { id: "reduced", label: "Reduziert" },
            ]}
          />
        </SettingRow>
        <SettingRow label="Wischgesten" hint="Auf Touch-Geräten: nach links wischen entnimmt, nach rechts bearbeitet.">
          <Switch checked={s.swipe} onChange={(swipe) => save({ swipe })} label="Wischgesten" />
        </SettingRow>
        <SettingRow label="Standard-Kühlgerät" hint="Wird beim Einlegen vorausgewählt.">
          <select
            className="input w-auto min-h-10"
            value={s.defaultApplianceId ?? ""}
            onChange={(e) => save({ defaultApplianceId: e.target.value || null })}
            aria-label="Standard-Kühlgerät"
          >
            <option value="">Zuletzt benutztes</option>
            {appliances.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </SettingRow>
      </Card>
    </Section>
  );
}

/* ---------------- Startseite ---------------- */

const HOME_LABELS: Record<HomeSectionId, { label: string; hint: string }> = {
  due: { label: "Muss bald weg", hint: "Abgelaufenes und bald Fälliges" },
  appliances: { label: "Kühlgeräte", hint: "Türen aller Geräte" },
  recent: { label: "Zuletzt eingelegt", hint: "Die fünf neuesten Artikel" },
  stats: { label: "Kurzstatistik", hint: "Bestand, bald fällig, abgelaufen" },
};

export function HomeSection() {
  const s = useUserSettings().data;
  const save = useSave();
  if (!s) return null;
  const move = (i: number, d: -1 | 1) => {
    const next = [...s.home];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    void save({ home: next });
  };
  return (
    <Section id="startseite" title="Startseite" intro="Welche Bereiche die Übersicht zeigt – und in welcher Reihenfolge.">
      <Card>
        <ol className="divide-y divide-line">
          {s.home.map((h, i) => (
            <li key={h.id} className="flex items-center gap-2 px-5 py-2.5">
              <span className="min-w-0 flex-1">
                <span className={`block font-medium ${h.visible ? "" : "text-ink-faint"}`}>{HOME_LABELS[h.id].label}</span>
                <span className="block text-sm text-ink-soft">{HOME_LABELS[h.id].hint}</span>
              </span>
              <button className="icon-btn size-9" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`${HOME_LABELS[h.id].label} nach oben`}>
                <ArrowUp className="size-4" />
              </button>
              <button className="icon-btn size-9" disabled={i === s.home.length - 1} onClick={() => move(i, 1)} aria-label={`${HOME_LABELS[h.id].label} nach unten`}>
                <ArrowDown className="size-4" />
              </button>
              <Switch
                checked={h.visible}
                onChange={(visible) => save({ home: s.home.map((x) => (x.id === h.id ? { ...x, visible } : x)) })}
                label={`${HOME_LABELS[h.id].label} anzeigen`}
              />
            </li>
          ))}
        </ol>
      </Card>
    </Section>
  );
}

/* ---------------- Erweiterter Modus ---------------- */

export function ExtendedSection() {
  const s = useUserSettings().data;
  const save = useSave();
  if (!s) return null;
  const e = s.extended;
  const on = s.mode === "extended";
  const set = (patch: Partial<UserSettings["extended"]>) => save({ extended: patch });
  return (
    <Section
      id="erweitert"
      title="Erweiterter Modus"
      intro="Zeigt Kühlgeräte zusätzlich als 2,5D-Ansicht: Tür öffnen, Schubladen herausziehen und Artikel im Raster so platzieren, wie sie wirklich liegen."
    >
      <Card className="divide-y divide-line">
        <SettingRow label="Erweiterter Modus" hint={on ? "Eingeschaltet" : "Die normale Listenansicht bleibt immer verfügbar."}>
          <Switch checked={on} onChange={(v) => save({ mode: v ? "extended" : "standard" })} label="Erweiterter Modus" />
        </SettingRow>
        {on && (
          <>
            <div className="px-5 py-4">
              <ExtendedPreview ext={e} />
            </div>
            <SettingRow label="Perspektive">
              <Segmented
                label="Perspektive"
                value={e.perspective}
                onChange={(perspective) => set({ perspective })}
                options={[
                  { id: "flat", label: "Flach" },
                  { id: "subtle", label: "Leicht" },
                  { id: "strong", label: "Stark" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Artikel als">
              <Segmented
                label="Artikel als"
                value={e.tileStyle}
                onChange={(tileStyle) => set({ tileStyle })}
                options={[
                  { id: "photo", label: "Foto" },
                  { id: "icon", label: "Symbol" },
                  { id: "block", label: "Farbblock" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Feldgröße" hint="Wird auf kleinen Bildschirmen automatisch verkleinert.">
              <Segmented
                label="Feldgröße"
                value={e.cellSize}
                onChange={(cellSize) => set({ cellSize })}
                options={[
                  { id: "S", label: "Klein" },
                  { id: "M", label: "Mittel" },
                  { id: "L", label: "Groß" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Namen auf den Artikeln">
              <Switch checked={e.showNames} onChange={(showNames) => set({ showNames })} label="Namen auf den Artikeln" />
            </SettingRow>
            <SettingRow label="Haltbarkeit markieren" hint="Rahmen und Symbol für bald fällige und abgelaufene Artikel.">
              <Switch checked={e.showExpiry} onChange={(showExpiry) => set({ showExpiry })} label="Haltbarkeit markieren" />
            </SettingRow>
            <SettingRow label="Geräte in 2,5D öffnen" hint="Sonst startet die Geräteansicht mit der Liste.">
              <Switch checked={e.openIn3d} onChange={(openIn3d) => set({ openIn3d })} label="Geräte in 2,5D öffnen" />
            </SettingRow>
          </>
        )}
      </Card>
    </Section>
  );
}

/** Live-Vorschau eines Fachs mit Beispielartikeln. */
function ExtendedPreview({ ext }: { ext: UserSettings["extended"] }) {
  const cats = useCategories();
  const cat = (id: string) => cats.find((c) => c.id === id)?.id ?? "other";
  const comp: Compartment = { id: "preview", applianceId: "", name: "Vorschau", sortOrder: 0, kind: "shelf", zone: null, gridCols: 6, gridRows: 2, maxStack: 2, height: 2 };
  const today = new Date();
  const iso = (d: number) => new Date(today.getTime() + d * 86_400_000).toISOString().slice(0, 10);
  const sample = (id: string, name: string, category: string, x: number, y: number, w: number, h: number, bb: string | null, level = 0): Item =>
    ({ id, name, category: cat(category), icon: null, photoId: null, gridX: x, gridY: y, gridW: w, gridH: h, stackLevel: level, bestBefore: bb }) as Item;
  const items = [
    sample("p1", "Milch", "dairy", 0, 0, 1, 2, iso(5)),
    sample("p2", "Käse", "cheese", 1, 0, 2, 1, iso(1)),
    sample("p3", "Wurst", "meat", 1, 1, 2, 1, iso(-1)),
    sample("p4", "Reste", "leftovers", 3, 0, 2, 2, iso(10)),
    sample("p5", "Joghurt", "dairy", 3, 0, 1, 1, iso(8), 1),
    sample("p6", "Eier", "eggs", 5, 0, 1, 1, null),
  ];
  const cell = { S: 32, M: 44, L: 56 }[ext.cellSize];
  const tilt = { flat: 0, subtle: 26, strong: 44 }[ext.perspective];
  return (
    <figure className="flex flex-col items-center gap-2 rounded-2xl bg-steel-tint/50 p-4">
      <div className="overflow-x-auto pt-2" style={{ perspective: 900 }}>
        <div className="w-fit rounded-b-md border-b-[6px] border-steel/25" style={{ transform: `rotateX(${tilt}deg)`, transformOrigin: "50% 100%" }}>
          <Surface
            compartment={comp}
            placed={items.map((i) => ({ id: i.id, x: i.gridX!, y: i.gridY!, w: i.gridW!, h: i.gridH!, level: i.stackLevel!, item: i }))}
            cell={cell}
            opts={{ tileStyle: ext.tileStyle, showNames: ext.showNames, showExpiry: ext.showExpiry }}
          />
        </div>
      </div>
      <figcaption className="flex items-center gap-1.5 text-xs text-ink-soft">
        <Box className="size-3.5" /> Vorschau mit Beispielartikeln
      </figcaption>
    </figure>
  );
}
