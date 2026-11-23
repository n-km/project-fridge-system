/** Lokales Datum als YYYY-MM-DD. */
export function todayIso(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayIso(d);
}

/** Ganze Tage von heute bis zum Datum (negativ = vergangen). */
export function daysUntil(iso: string) {
  const a = new Date(`${todayIso()}T12:00:00`).getTime();
  const b = new Date(`${iso}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

const dateFmt = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });

export function formatDate(isoOrDate: string | Date, short = false) {
  const d = typeof isoOrDate === "string" && isoOrDate.length === 10 ? new Date(`${isoOrDate}T12:00:00`) : new Date(isoOrDate);
  return (short ? shortFmt : dateFmt).format(d);
}

/** „vor 3 Tagen“, „heute“, „gestern“ */
export function relativeDays(isoOrDate: string | Date) {
  const d = new Date(isoOrDate);
  const days = -daysUntil(todayIso(d));
  if (days <= 0) return "heute";
  if (days === 1) return "gestern";
  if (days < 30) return `vor ${days} Tagen`;
  if (days < 60) return "vor einem Monat";
  return `vor ${Math.round(days / 30)} Monaten`;
}

export type ExpiryState = "none" | "fresh" | "soon" | "expired";

export function expiryState(bestBefore: string | null, soonDays = 3): ExpiryState {
  if (!bestBefore) return "none";
  const d = daysUntil(bestBefore);
  if (d < 0) return "expired";
  if (d <= soonDays) return "soon";
  return "fresh";
}

export function expiryText(bestBefore: string | null) {
  if (!bestBefore) return "Kein MHD";
  const d = daysUntil(bestBefore);
  if (d < -1) return `Seit ${-d} Tagen abgelaufen`;
  if (d === -1) return "Seit gestern abgelaufen";
  if (d === 0) return "Heute fällig";
  if (d === 1) return "Morgen fällig";
  if (d < 60) return `Noch ${d} Tage`;
  return `Bis ${formatDate(bestBefore, true)}`;
}

export function formatQuantity(q: number | null, unit: string | null) {
  if (q == null) return unit ?? "";
  const n = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(q);
  return unit ? `${n} ${unit}` : n;
}
