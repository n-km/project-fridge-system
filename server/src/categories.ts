/**
 * Kategorien mit Standard-Icon. Neue Kategorien einfach hier ergänzen –
 * das Frontend holt sich die Liste über GET /api/meta.
 */
export const CATEGORIES = [
  { id: "dairy", label: "Milchprodukte", icon: "🥛" },
  { id: "cheese", label: "Käse", icon: "🧀" },
  { id: "eggs", label: "Eier", icon: "🥚" },
  { id: "meat", label: "Fleisch & Wurst", icon: "🥩" },
  { id: "fish", label: "Fisch", icon: "🐟" },
  { id: "vegetables", label: "Gemüse", icon: "🥦" },
  { id: "fruit", label: "Obst", icon: "🍎" },
  { id: "leftovers", label: "Reste & Gekochtes", icon: "🍲" },
  { id: "bakery", label: "Backwaren", icon: "🍞" },
  { id: "drinks", label: "Getränke", icon: "🧃" },
  { id: "sauces", label: "Saucen & Aufstriche", icon: "🥫" },
  { id: "sweets", label: "Süßes & Eis", icon: "🍨" },
  { id: "frozen", label: "Tiefkühlware", icon: "🧊" },
  { id: "other", label: "Sonstiges", icon: "📦" },
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
