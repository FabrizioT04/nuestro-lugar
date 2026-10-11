// Formato de fechas y textos para la interfaz (español).

const longDate = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", timeZone: "UTC" });
const numberFormat = new Intl.NumberFormat("es");

/** "YYYY-MM-DD" → Date a medianoche UTC (las fechas de calendario no tienen zona horaria). */
function calendarDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** "1 de febrero de 2026" */
export const formatLongDate = (date: string) => longDate.format(calendarDate(date));

/** "1 de febrero" */
export const formatDayMonth = (date: string) => dayMonth.format(calendarDate(date));

export const formatNumber = (value: number) => numberFormat.format(value);

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}

/** "Es hoy", "Es mañana" o "Faltan 34 días". */
export function formatCountdown(daysUntil: number): string {
  if (daysUntil === 0) return "Es hoy";
  if (daysUntil === 1) return "Es mañana";
  return `Faltan ${plural(daysUntil, "día")}`;
}

/** "8 meses y 10 días", "2 años y 3 meses"... (solo las dos unidades más grandes). */
export function formatDuration({ years, months }: { years: number; months: number }): string | null {
  const units = [
    years > 0 ? plural(years, "año") : null,
    months > 0 ? plural(months, "mes", "meses") : null,
  ].filter((unit): unit is string => unit !== null);
  return units.length > 0 ? units.join(" y ") : null;
}

/** "14 de febrero de 2027, 09:30" en la zona horaria de la pareja (instantes UTC, no fechas de calendario). */
export function formatDateTimeIn(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).format(new Date(iso));
}

/** "14/02/2027" en la zona horaria de la pareja. */
export function formatShortDateIn(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("es", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: timezone }).format(new Date(iso));
}

/** "S/ 120.50", "US$ 40.00"… según la moneda. */
export function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(amountCents / 100);
}

/** "Hoy", "Mañana", "En 5 días", "Ayer", "Hace 3 días". */
export function formatRelativeDays(days: number): string {
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days === -1) return "Ayer";
  return days > 0 ? `En ${plural(days, "día")}` : `Hace ${plural(-days, "día")}`;
}
