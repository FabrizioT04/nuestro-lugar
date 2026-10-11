import type { ImportantDate } from "@shared/api";
import { daysBetween, nextYearlyOccurrence } from "@shared/dates";
import { IMPORTANT_DATE_TYPE_INFO } from "@shared/importantDates";
import type { ImportantDateInput } from "@shared/schemas";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createImportantDateRepository, type ImportantDateRow } from "../repositories/importantDateRepository";
import { conflict, notFound } from "../utils/errors";

const relationshipOf = (user: AuthenticatedUser) => user.relationshipId!;

/** Calcula la próxima vez que toca una fecha (en el calendario de la pareja). */
export function toImportantDate(row: ImportantDateRow, today: string): ImportantDate {
  const recurs = row.recurs_yearly === 1;
  let nextDate: string | null = null;
  let years: number | null = null;
  if (recurs) {
    const next = nextYearlyOccurrence(row.event_date, today);
    nextDate = next.date;
    years = next.years;
  } else if (row.event_date >= today) {
    nextDate = row.event_date;
  }
  return {
    id: row.id,
    title: row.title,
    type: row.date_type,
    eventDate: row.event_date,
    recursYearly: recurs,
    emoji: row.emoji ?? IMPORTANT_DATE_TYPE_INFO[row.date_type].emoji,
    notes: row.notes,
    nextDate,
    daysUntil: nextDate ? daysBetween(today, nextDate) : null,
    years,
  };
}

/** Las que tienen próxima fecha primero (las más cercanas arriba); las ya pasadas al final, de la más reciente. */
export function sortImportantDates(dates: ImportantDate[]): ImportantDate[] {
  return [...dates].sort((a, b) => {
    if (a.daysUntil !== null && b.daysUntil !== null) return a.daysUntil - b.daysUntil;
    if (a.daysUntil !== null) return -1;
    if (b.daysUntil !== null) return 1;
    return b.eventDate.localeCompare(a.eventDate);
  });
}

export async function listImportantDates(env: Bindings, user: AuthenticatedUser, today: string): Promise<ImportantDate[]> {
  const rows = await createImportantDateRepository(env.DB).list(relationshipOf(user));
  return sortImportantDates(rows.map((row) => toImportantDate(row, today)));
}

async function requireDate(env: Bindings, user: AuthenticatedUser, id: string): Promise<ImportantDateRow> {
  const row = await createImportantDateRepository(env.DB).find(relationshipOf(user), id);
  if (!row) throw notFound("Fecha no encontrada");
  return row;
}

export async function getImportantDate(env: Bindings, user: AuthenticatedUser, id: string, today: string): Promise<ImportantDate> {
  return toImportantDate(await requireDate(env, user, id), today);
}

export async function createImportantDate(
  env: Bindings,
  user: AuthenticatedUser,
  input: ImportantDateInput & { id?: string },
  today: string,
): Promise<ImportantDate> {
  const id = input.id ?? crypto.randomUUID();
  try {
    await createImportantDateRepository(env.DB).create(id, relationshipOf(user), user.id, input);
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed: important_dates.id")) throw conflict("Esta fecha ya existe");
    throw err;
  }
  return getImportantDate(env, user, id, today);
}

export async function updateImportantDate(
  env: Bindings,
  user: AuthenticatedUser,
  id: string,
  input: ImportantDateInput,
  today: string,
): Promise<ImportantDate> {
  await requireDate(env, user, id);
  await createImportantDateRepository(env.DB).update(id, relationshipOf(user), input);
  return getImportantDate(env, user, id, today);
}

export async function deleteImportantDate(env: Bindings, user: AuthenticatedUser, id: string): Promise<void> {
  await requireDate(env, user, id);
  await createImportantDateRepository(env.DB).softDelete(id, relationshipOf(user));
}
