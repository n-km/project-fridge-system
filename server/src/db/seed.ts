import { isNull } from "drizzle-orm";
import type { Db } from "./index.js";
import { presets } from "./schema.js";

type SeedPreset = {
  name: string;
  category: string;
  icon: string;
  qty?: number;
  unit?: string;
  /** Haltbarkeit im Kühlschrank in Tagen */
  fridge?: number;
  /** Haltbarkeit im Tiefkühler in Tagen */
  freezer?: number;
};

/** Globale Start-Presets. Richtwerte – beim Hinzufügen immer änderbar. */
const GLOBAL_PRESETS: SeedPreset[] = [
  { name: "Milch", category: "dairy", icon: "🥛", qty: 1, unit: "l", fridge: 5 },
  { name: "Joghurt", category: "dairy", icon: "🥣", qty: 500, unit: "g", fridge: 10 },
  { name: "Butter", category: "dairy", icon: "🧈", qty: 250, unit: "g", fridge: 30, freezer: 180 },
  { name: "Sahne", category: "dairy", icon: "🥛", qty: 200, unit: "ml", fridge: 7 },
  { name: "Quark", category: "dairy", icon: "🥣", qty: 500, unit: "g", fridge: 7 },
  { name: "Käse (Scheiben)", category: "cheese", icon: "🧀", qty: 1, unit: "Packung", fridge: 14 },
  { name: "Mozzarella", category: "cheese", icon: "🧀", qty: 125, unit: "g", fridge: 5 },
  { name: "Eier", category: "eggs", icon: "🥚", qty: 10, unit: "Stück", fridge: 21 },
  { name: "Hackfleisch", category: "meat", icon: "🥩", qty: 500, unit: "g", fridge: 1, freezer: 90 },
  { name: "Hähnchenbrust", category: "meat", icon: "🍗", qty: 400, unit: "g", fridge: 2, freezer: 180 },
  { name: "Wurst (Aufschnitt)", category: "meat", icon: "🥓", qty: 1, unit: "Packung", fridge: 5 },
  { name: "Lachs", category: "fish", icon: "🐟", qty: 250, unit: "g", fridge: 2, freezer: 90 },
  { name: "Salat", category: "vegetables", icon: "🥬", qty: 1, unit: "Stück", fridge: 5 },
  { name: "Paprika", category: "vegetables", icon: "🫑", qty: 3, unit: "Stück", fridge: 7 },
  { name: "Tomaten", category: "vegetables", icon: "🍅", qty: 500, unit: "g", fridge: 7 },
  { name: "Gurke", category: "vegetables", icon: "🥒", qty: 1, unit: "Stück", fridge: 7 },
  { name: "Karotten", category: "vegetables", icon: "🥕", qty: 1, unit: "kg", fridge: 21 },
  { name: "Erbsen (TK)", category: "frozen", icon: "🫛", qty: 450, unit: "g", freezer: 365 },
  { name: "Beeren", category: "fruit", icon: "🫐", qty: 250, unit: "g", fridge: 4, freezer: 270 },
  { name: "Äpfel", category: "fruit", icon: "🍎", qty: 1, unit: "kg", fridge: 30 },
  { name: "Reste vom Essen", category: "leftovers", icon: "🍲", qty: 1, unit: "Portion", fridge: 3, freezer: 90 },
  { name: "Suppe / Eintopf", category: "leftovers", icon: "🍜", qty: 1, unit: "Dose", fridge: 3, freezer: 120 },
  { name: "Bolognese", category: "leftovers", icon: "🍝", qty: 1, unit: "Dose", fridge: 3, freezer: 90 },
  { name: "Brot", category: "bakery", icon: "🍞", qty: 1, unit: "Stück", freezer: 90 },
  { name: "Brötchen", category: "bakery", icon: "🥐", qty: 6, unit: "Stück", freezer: 90 },
  { name: "Saft", category: "drinks", icon: "🧃", qty: 1, unit: "l", fridge: 7 },
  { name: "Senf / Ketchup", category: "sauces", icon: "🥫", qty: 1, unit: "Stück", fridge: 90 },
  { name: "Marmelade", category: "sauces", icon: "🍓", qty: 1, unit: "Stück", fridge: 60 },
  { name: "Speiseeis", category: "sweets", icon: "🍨", qty: 1, unit: "Packung", freezer: 180 },
  { name: "Pizza (TK)", category: "frozen", icon: "🍕", qty: 1, unit: "Stück", freezer: 180 },
];

/** Legt fehlende globale Presets an. Mehrfach aufrufbar. */
export async function seedGlobalPresets(db: Db) {
  const existing = await db
    .select({ name: presets.name })
    .from(presets)
    .where(isNull(presets.householdId));
  const names = new Set(existing.map((p) => p.name));
  const missing = GLOBAL_PRESETS.filter((p) => !names.has(p.name));
  if (missing.length === 0) return 0;
  await db.insert(presets).values(
    missing.map((p) => ({
      householdId: null,
      name: p.name,
      category: p.category,
      icon: p.icon,
      defaultQuantity: p.qty ?? null,
      defaultUnit: p.unit ?? null,
      shelfLifeFridgeDays: p.fridge ?? null,
      shelfLifeFreezerDays: p.freezer ?? null,
    })),
  );
  return missing.length;
}
