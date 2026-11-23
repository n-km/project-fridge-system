import path from "node:path";

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 3000),
  host: env.HOST ?? "0.0.0.0",
  databaseUrl: env.DATABASE_URL ?? "postgres://pfs:pfs@localhost:5432/pfs",
  /** Ordner für hochgeladene Fotos. */
  uploadDir: path.resolve(env.UPLOAD_DIR ?? "./uploads"),
  /** Gebautes Frontend, das im Produktivbetrieb mit ausgeliefert wird. */
  webDist: env.WEB_DIST ? path.resolve(env.WEB_DIST) : undefined,
  /** Auf true setzen, sobald die App hinter HTTPS läuft. */
  cookieSecure: env.COOKIE_SECURE === "true",
  /** Registrierung neuer Haushalte erlauben (Beitritt per Einladungscode geht immer). */
  allowRegistration: env.ALLOW_REGISTRATION !== "false",
  sessionDays: 30,
  maxUploadBytes: 15 * 1024 * 1024,
  /** Ab wie vielen Tagen vor MHD ein Artikel als „bald fällig“ gilt. */
  expiringSoonDays: Number(env.EXPIRING_SOON_DAYS ?? 3),
  /** Zeitzone für „heute“ (MHD-Berechnung). */
  timeZone: env.TZ || "Europe/Berlin",
};
