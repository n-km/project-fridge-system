import { config } from "./config.js";

/** Heutiges Datum als YYYY-MM-DD in der konfigurierten Zeitzone. */
export function today(now = new Date()) {
  // sv-SE formatiert Datumsangaben als ISO (YYYY-MM-DD)
  return now.toLocaleDateString("sv-SE", { timeZone: config.timeZone });
}

/** Addiert Tage zu einem YYYY-MM-DD-Datum. */
export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
