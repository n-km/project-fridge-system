import {
  date,
  index,
  integer,
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
