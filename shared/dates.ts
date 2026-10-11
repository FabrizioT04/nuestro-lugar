// Utilidades de fechas puras (sin dependencias de navegador ni de Cloudflare).
// Las fechas "de calendario" se manejan como texto YYYY-MM-DD para evitar sorpresas de zona horaria.

const MS_PER_DAY = 86_400_000;

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y ?? 0, m ?? 1, d ?? 1];
}

function toUtc(date: string): number {
  const [y, m, d] = parts(date);
  return Date.UTC(y, m - 1, d);
}

function format(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Fecha de hoy (YYYY-MM-DD) en una zona horaria IANA. */
export function todayIn(timezone: string, now: Date = new Date()): string {
  // en-CA produce exactamente YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Días de calendario de `from` a `to` (negativo si `to` es anterior). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY);
}

/** El mismo día y mes que `date`, en el año indicado (29/02 pasa a 28/02 en años no bisiestos). */
function sameDayInYear(date: string, year: number): string {
  const [, m, d] = parts(date);
  const day = m === 2 && d === 29 && !isLeapYear(year) ? 28 : d;
  return format(year, m, day);
}

/**
 * Próxima vez (hoy incluido) que se repite el día y mes de `date`, siempre posterior al año original.
 * `years` es cuántos años se cumplen en esa fecha.
 */
export function nextYearlyOccurrence(date: string, today: string): { date: string; years: number } {
  const [originYear] = parts(date);
  const [todayYear] = parts(today);
  let year = Math.max(todayYear, originYear + 1);
  let candidate = sameDayInYear(date, year);
  if (candidate < today) {
    year += 1;
    candidate = sameDayInYear(date, year);
  }
  return { date: candidate, years: year - originYear };
}

/** Tiempo transcurrido en años, meses y días de calendario (31/01 + 1 mes = 28/02). */
export function elapsedParts(from: string, to: string): { years: number; months: number; days: number } {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  let totalMonths = (ty - fy) * 12 + (tm - fm);
  if (td < fd) totalMonths -= 1;

  const anchorMonthIndex = fm - 1 + totalMonths;
  const anchorYear = fy + Math.floor(anchorMonthIndex / 12);
  const anchorMonth = (anchorMonthIndex % 12) + 1;
  const anchor = format(anchorYear, anchorMonth, Math.min(fd, daysInMonth(anchorYear, anchorMonth)));

  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12, days: daysBetween(anchor, to) };
}

// ---------------------------------------------------------------------------
// Fecha y hora "de pared" en una zona horaria ↔ instante UTC
// ---------------------------------------------------------------------------

function wallClockParts(instant: number, timezone: string) {
  const values: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant))) {
    values[part.type] = part.value;
  }
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

/** Diferencia (ms) entre la hora local de `timezone` y UTC en ese instante. */
function offsetAt(instant: number, timezone: string): number {
  const { date, time } = wallClockParts(instant, timezone);
  const [h, min] = time.split(":").map(Number);
  return toUtc(date) + (h ?? 0) * 3_600_000 + (min ?? 0) * 60_000 - Math.floor(instant / 60_000) * 60_000;
}

/**
 * "2027-02-01" a las "09:00" en America/Lima → instante UTC (Date).
 * Si la hora no existe por un cambio de horario (02:30 al adelantar el reloj), se ajusta una hora.
 */
export function zonedTimeToUtc(date: string, time: string, timezone: string): Date {
  const [h, min] = time.split(":").map(Number);
  const asIfUtc = toUtc(date) + (h ?? 0) * 3_600_000 + (min ?? 0) * 60_000;
  const firstGuess = asIfUtc - offsetAt(asIfUtc, timezone);
  const secondOffset = offsetAt(firstGuess, timezone);
  return new Date(asIfUtc - secondOffset);
}

/** Instante UTC → fecha (YYYY-MM-DD) y hora (HH:MM) en la zona indicada. */
export function utcToZoned(iso: string, timezone: string): { date: string; time: string } {
  return wallClockParts(Date.parse(iso), timezone);
}
