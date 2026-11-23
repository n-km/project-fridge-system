export type ApplianceType = "fridge" | "freezer";
export type RemovalReason = "consumed" | "discarded" | "given_away" | "other";

export interface Compartment {
  id: string;
  applianceId: string;
  name: string;
  sortOrder: number;
}

export interface Appliance {
  id: string;
  name: string;
  location: string | null;
  type: ApplianceType;
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
  global: boolean;
}

export interface Meta {
  categories: { id: string; label: string; icon: string }[];
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
