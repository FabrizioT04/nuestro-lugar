import type { HomeResponse, RelationshipSummary, UpcomingMoment } from "@shared/api";
import { daysBetween, elapsedParts, nextYearlyOccurrence, todayIn } from "@shared/dates";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createHomeRepository, type ImportantDateRow } from "../repositories/homeRepository";
import { createRelationshipRepository } from "../repositories/relationshipRepository";
import { notFound } from "../utils/errors";

function anniversaryMoment(relationship: RelationshipSummary, today: string): UpcomingMoment {
  const next = nextYearlyOccurrence(relationship.startedOn, today);
  return {
    title: next.years === 1 ? "Nuestro primer aniversario" : "Nuestro aniversario",
    emoji: "💞",
    date: next.date,
    daysUntil: daysBetween(today, next.date),
    years: next.years,
  };
}

function importantDateMoment(row: ImportantDateRow, today: string): UpcomingMoment | null {
  if (row.recurs_yearly === 1) {
    const next = nextYearlyOccurrence(row.event_date, today);
    return { title: row.title, emoji: row.emoji ?? "✨", date: next.date, daysUntil: daysBetween(today, next.date), years: next.years };
  }
  const daysUntil = daysBetween(today, row.event_date);
  if (daysUntil < 0) return null;
  return { title: row.title, emoji: row.emoji ?? "✨", date: row.event_date, daysUntil, years: null };
}

export async function getHome(env: Bindings, user: AuthenticatedUser): Promise<HomeResponse> {
  // requireRelationship garantiza que existe; la comprobación es por si se usa sin ese middleware.
  if (!user.relationshipId) throw notFound("Relación no configurada");

  const homeRepository = createHomeRepository(env.DB);
  const [relationship, importantDates, highlightedMemory] = await Promise.all([
    createRelationshipRepository(env.DB).findSummary(user.relationshipId),
    homeRepository.listImportantDates(user.relationshipId),
    homeRepository.findHighlightedMemory(user.relationshipId),
  ]);
  if (!relationship) throw notFound("Relación no encontrada");

  // "Hoy" es el de la zona horaria de la pareja, no el del servidor.
  const today = todayIn(relationship.timezone);
  const { years, months } = elapsedParts(relationship.startedOn, today);

  const candidates = [
    anniversaryMoment(relationship, today),
    ...importantDates.map((row) => importantDateMoment(row, today)),
  ].filter((moment): moment is UpcomingMoment => moment !== null);
  candidates.sort((a, b) => a.daysUntil - b.daysUntil);

  return {
    relationship,
    today,
    together: { days: daysBetween(relationship.startedOn, today), years, months },
    nextMoment: candidates[0] ?? null,
    highlightedMemory,
  };
}
