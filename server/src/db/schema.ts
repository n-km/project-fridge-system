import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const applianceType = pgEnum("appliance_type", ["fridge", "freezer"]);
/** Bauform: stehend (Tür vorne) oder Truhe (Deckel oben). */
export const applianceLayout = pgEnum("appliance_layout", ["upright", "chest"]);
/** Art eines Fachs – bestimmt die Darstellung im erweiterten Modus. */
export const compartmentKind = pgEnum("compartment_kind", [
  "shelf",
  "drawer",
  "door",
  "basket",
  "bottle",
]);
export const itemStatus = pgEnum("item_status", ["active", "archived"]);
export const removalReason = pgEnum("removal_reason", [
  "consumed",
  "discarded",
  "given_away",
  "other",
]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/* ------------------------------------------------------------------ */
/* Haushalt & Benutzer                                                 */
/* ------------------------------------------------------------------ */

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 des Session-Tokens – das Token selbst wird nie gespeichert. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* Kühlgeräte & Fächer                                                 */
/* ------------------------------------------------------------------ */

export const appliances = pgTable(
  "appliances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    location: text("location"),
    type: applianceType("type").notNull().default("fridge"),
    layout: applianceLayout("layout").notNull().default("upright"),
    color: text("color"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("appliances_household_idx").on(t.householdId)],
);

export const compartments = pgTable(
  "compartments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applianceId: uuid("appliance_id")
      .notNull()
      .references(() => appliances.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    kind: compartmentKind("kind").notNull().default("shelf"),
    /** Abweichende Zone, z. B. Gefrierfach in einem Kühlschrank (Kühl-Gefrier-Kombi). null = wie Gerät. */
    zone: applianceType("zone"),
    /** Raster: Breite × Tiefe in Zellen. */
    gridCols: integer("grid_cols").notNull().default(6),
    gridRows: integer("grid_rows").notNull().default(3),
    /** Wie viele Artikel übereinander gestapelt werden dürfen. */
    maxStack: integer("max_stack").notNull().default(2),
    /** Höhe des Fachs in Stufen (1–4), nur für die Darstellung. */
    height: integer("height").notNull().default(2),
  },
  (t) => [index("compartments_appliance_idx").on(t.applianceId)],
);

/* ------------------------------------------------------------------ */
/* Fotos                                                               */
/* ------------------------------------------------------------------ */

export const photos = pgTable("photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  thumbName: text("thumb_name").notNull(),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

export const presets = pgTable(
  "presets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** null = globales Preset (für alle Haushalte sichtbar, nur lesbar). */
    householdId: uuid("household_id").references(() => households.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    category: text("category").notNull().default("other"),
    icon: text("icon"),
    defaultQuantity: numeric("default_quantity", { mode: "number" }),
    defaultUnit: text("default_unit"),
    shelfLifeFridgeDays: integer("shelf_life_fridge_days"),
    shelfLifeFreezerDays: integer("shelf_life_freezer_days"),
    barcode: text("barcode"),
    photoId: uuid("photo_id").references(() => photos.id, {
      onDelete: "set null",
    }),
    /** Standardgröße im Raster. */
    gridW: integer("grid_w"),
    gridH: integer("grid_h"),
    createdAt: createdAt(),
  },
  (t) => [index("presets_household_idx").on(t.householdId)],
);

/* ------------------------------------------------------------------ */
/* Artikel                                                             */
/* ------------------------------------------------------------------ */

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    /** Wird null, wenn das Gerät gelöscht wurde (nur bei archivierten Artikeln möglich). */
    applianceId: uuid("appliance_id").references(() => appliances.id, {
      onDelete: "set null",
    }),
    compartmentId: uuid("compartment_id").references(() => compartments.id, {
      onDelete: "set null",
    }),
    presetId: uuid("preset_id").references(() => presets.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    category: text("category").notNull().default("other"),
    icon: text("icon"),
    quantity: numeric("quantity", { mode: "number" }),
    unit: text("unit"),
    position: text("position"),
    note: text("note"),
    storedAt: timestamp("stored_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    bestBefore: date("best_before", { mode: "string" }),
    photoId: uuid("photo_id").references(() => photos.id, {
      onDelete: "set null",
    }),
    /** Platz im Raster des Fachs (alle null = nicht platziert). */
    gridX: integer("grid_x"),
    gridY: integer("grid_y"),
    gridW: integer("grid_w"),
    gridH: integer("grid_h"),
    stackLevel: integer("stack_level"),
    status: itemStatus("status").notNull().default("active"),
    removalReason: removalReason("removal_reason"),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("items_household_status_idx").on(t.householdId, t.status),
    index("items_appliance_idx").on(t.applianceId),
    index("items_best_before_idx").on(t.bestBefore),
  ],
);

/* ------------------------------------------------------------------ */
/* Einstellungen                                                       */
/* ------------------------------------------------------------------ */

/** Einstellungen, die für alle Mitglieder eines Haushalts gelten. */
export const householdSettings = pgTable("household_settings", {
  householdId: uuid("household_id")
    .primaryKey()
    .references(() => households.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Persönliche Einstellungen eines Benutzers. */
export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
