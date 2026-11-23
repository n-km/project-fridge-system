export type ApplianceType = "fridge" | "freezer";
export type RemovalReason = "consumed" | "discarded" | "given_away" | "other";

export type CompartmentKind = "shelf" | "drawer" | "door" | "basket" | "bottle";

export interface Compartment {
  id: string;
  applianceId: string;
  name: string;
  sortOrder: number;
  kind: CompartmentKind;
  /** Abweichende Zone (z. B. Gefrierfach in einer Kombi); null = wie Gerät */
  zone: ApplianceType | null;
  gridCols: number;
  gridRows: number;
  maxStack: number;
  height: number;
}

export interface Appliance {
  id: string;
  name: string;
  location: string | null;
  type: ApplianceType;
  layout: "upright" | "chest";
  color: string | null;
  sortOrder: number;
  compartments: Compartment[];
  counts?: { active: number; expired: number; expiringSoon: number };
}

export interface Item {
  id: string;
  applianceId: string | null;
  compartmentId: string | null;
  presetId: string | null;
  name: string;
  category: string;
  icon: string | null;
  quantity: number | null;
  unit: string | null;
  position: string | null;
  note: string | null;
  storedAt: string;
  bestBefore: string | null;
  photoId: string | null;
  gridX: number | null;
  gridY: number | null;
  gridW: number | null;
  gridH: number | null;
  stackLevel: number | null;
  status: "active" | "archived";
  removalReason: RemovalReason | null;
  removedAt: string | null;
  applianceName: string | null;
  applianceType: ApplianceType | null;
  compartmentName: string | null;
}

export interface Preset {
  id: string;
  name: string;
  category: string;
  icon: string | null;
  defaultQuantity: number | null;
  defaultUnit: string | null;
  shelfLifeFridgeDays: number | null;
  shelfLifeFreezerDays: number | null;
  barcode: string | null;
  photoId: string | null;
  gridW: number | null;
  gridH: number | null;
  global: boolean;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
  custom?: boolean;
}

export interface CompartmentSpec {
  name: string;
  kind: CompartmentKind;
  zone?: ApplianceType | null;
  gridCols: number;
  gridRows: number;
  maxStack: number;
  height: number;
}

export interface ApplianceTemplate {
  id: string;
  label: string;
  type: ApplianceType;
  layout: "upright" | "chest";
  compartments: CompartmentSpec[];
}

export interface Meta {
  version: string;
  categories: Category[];
  compartmentKinds: { id: CompartmentKind; label: string }[];
  applianceTemplates: ApplianceTemplate[];
  units: string[];
  removalReasons: { id: RemovalReason; label: string; icon: string }[];
  expiringSoonDays: number;
  allowRegistration: boolean;
}

export interface Me {
  user: { id: string; email: string; displayName: string };
  household: { id: string; name: string; inviteCode: string };
}

export interface Stats {
  totals: { active: number; expired: number; expiringSoon: number; archived: number };
  byCategory: { category: string; count: number }[];
  removalsByMonth: ({ month: string } & Record<RemovalReason, number>)[];
  topDiscarded: { name: string; icon: string | null; count: number }[];
  waste90d: { total: number; discarded: number; rate: number | null };
}

export type HomeSectionId = "due" | "appliances" | "recent" | "stats";

export interface UserSettings {
  mode: "standard" | "extended";
  theme: "auto" | "light" | "dark";
  density: "comfortable" | "compact";
  motion: "auto" | "reduced";
  itemDisplay: "photo" | "icon";
  swipe: boolean;
  home: { id: HomeSectionId; visible: boolean }[];
  defaultApplianceId: string | null;
  extended: {
    perspective: "flat" | "subtle" | "strong";
    tileStyle: "photo" | "icon" | "block";
    cellSize: "S" | "M" | "L";
    showNames: boolean;
    showExpiry: boolean;
    openIn3d: boolean;
  };
}

export interface HouseholdSettings {
  expiringSoonDays: number;
  customCategories: { id: string; label: string; icon: string; color: string }[];
  hiddenCategories: string[];
  categoryOverrides: Record<string, { icon?: string; color?: string }>;
  extraUnits: string[];
}
