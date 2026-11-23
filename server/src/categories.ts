/**
 * Kategorien mit Standard-Icon. Neue Kategorien einfach hier ergänzen –
 * das Frontend holt sich die Liste über GET /api/meta.
 */
export const CATEGORIES = [
  { id: "dairy", color: "#9DC3E6", label: "Milchprodukte", icon: "🥛" },
  { id: "cheese", color: "#F2D27A", label: "Käse", icon: "🧀" },
  { id: "eggs", color: "#E9D8B4", label: "Eier", icon: "🥚" },
  { id: "meat", color: "#E59A8C", label: "Fleisch & Wurst", icon: "🥩" },
  { id: "fish", color: "#8FC1C8", label: "Fisch", icon: "🐟" },
  { id: "vegetables", color: "#9CCB8A", label: "Gemüse", icon: "🥦" },
  { id: "fruit", color: "#F0A27A", label: "Obst", icon: "🍎" },
  { id: "leftovers", color: "#D9A86C", label: "Reste & Gekochtes", icon: "🍲" },
  { id: "bakery", color: "#D8B27E", label: "Backwaren", icon: "🍞" },
  { id: "drinks", color: "#A9B8E8", label: "Getränke", icon: "🧃" },
  { id: "sauces", color: "#D88F8F", label: "Saucen & Aufstriche", icon: "🥫" },
  { id: "sweets", color: "#E7A9C9", label: "Süßes & Eis", icon: "🍨" },
  { id: "frozen", color: "#B8D8EC", label: "Tiefkühlware", icon: "🧊" },
  { id: "other", color: "#C4C9CC", label: "Sonstiges", icon: "📦" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [
  CategoryId,
  ...CategoryId[],
];

export const UNITS = ["Stück", "g", "kg", "ml", "l", "Packung", "Dose", "Portion"];

export const REMOVAL_REASONS = [
  { id: "consumed", label: "Verbraucht", icon: "✅" },
  { id: "discarded", label: "Weggeworfen", icon: "🗑️" },
  { id: "given_away", label: "Verschenkt", icon: "🎁" },
  { id: "other", label: "Sonstiges", icon: "↪️" },
] as const;

/* ------------------------------------------------------------------ */
/* Fächer & Bauformen                                                  */
/* ------------------------------------------------------------------ */

export const COMPARTMENT_KINDS = [
  { id: "shelf", label: "Ablage / Glasboden" },
  { id: "drawer", label: "Schublade" },
  { id: "door", label: "Türfach" },
  { id: "basket", label: "Korb" },
  { id: "bottle", label: "Flaschenablage" },
] as const;
export type CompartmentKind = (typeof COMPARTMENT_KINDS)[number]["id"];

export type CompartmentSpec = {
  name: string;
  kind: CompartmentKind;
  zone?: "fridge" | "freezer" | null;
  gridCols: number;
  gridRows: number;
  maxStack: number;
  height: number;
};

const shelf = (name: string): CompartmentSpec => ({ name, kind: "shelf", gridCols: 6, gridRows: 3, maxStack: 2, height: 2 });
const door = (name: string): CompartmentSpec => ({ name, kind: "door", gridCols: 6, gridRows: 1, maxStack: 1, height: 1 });
const drawer = (name: string, zone?: "freezer"): CompartmentSpec => ({
  name,
  kind: "drawer",
  zone: zone ?? null,
  gridCols: zone ? 5 : 6,
  gridRows: zone ? 3 : 2,
  maxStack: zone ? 3 : 2,
  height: 2,
});

/** Vorlagen für typische Geräte. Alles lässt sich danach im Editor ändern. */
export const APPLIANCE_TEMPLATES: {
  id: string;
  label: string;
  type: "fridge" | "freezer";
  layout: "upright" | "chest";
  compartments: CompartmentSpec[];
}[] = [
  {
    id: "fridge",
    label: "Kühlschrank",
    type: "fridge",
    layout: "upright",
    compartments: [shelf("Oberes Fach"), shelf("Mittleres Fach"), shelf("Unteres Fach"), drawer("Gemüsefach"), door("Tür oben"), door("Tür unten")],
  },
  {
    id: "combo",
    label: "Kühl-Gefrier-Kombi",
    type: "fridge",
    layout: "upright",
    compartments: [
      shelf("Oberes Fach"),
      shelf("Mittleres Fach"),
      shelf("Unteres Fach"),
      drawer("Gemüsefach"),
      door("Tür oben"),
      door("Tür unten"),
      drawer("Gefrierschublade 1", "freezer"),
      drawer("Gefrierschublade 2", "freezer"),
      drawer("Gefrierschublade 3", "freezer"),
    ],
  },
  {
    id: "freezer",
    label: "Gefrierschrank",
    type: "freezer",
    layout: "upright",
    compartments: [1, 2, 3, 4].map((n) => ({ ...drawer(`Schublade ${n}`, "freezer"), zone: null })),
  },
  {
    id: "chest",
    label: "Gefriertruhe",
    type: "freezer",
    layout: "chest",
    compartments: [
      { name: "Korb links", kind: "basket", gridCols: 4, gridRows: 3, maxStack: 2, height: 2 },
      { name: "Korb rechts", kind: "basket", gridCols: 4, gridRows: 3, maxStack: 2, height: 2 },
      { name: "Boden", kind: "shelf", gridCols: 8, gridRows: 4, maxStack: 4, height: 3 },
    ],
  },
  {
    id: "drinks",
    label: "Getränkekühlschrank",
    type: "fridge",
    layout: "upright",
    compartments: [
      { name: "Flaschen oben", kind: "bottle", gridCols: 6, gridRows: 2, maxStack: 1, height: 2 },
      { name: "Flaschen unten", kind: "bottle", gridCols: 6, gridRows: 2, maxStack: 1, height: 2 },
      shelf("Ablage"),
    ],
  },
];
