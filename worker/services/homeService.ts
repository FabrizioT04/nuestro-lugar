import type { HomeResponse, RelationshipSummary, UpcomingMoment } from "@shared/api";
import { daysBetween, elapsedParts, nextYearlyOccurrence, todayIn } from "@shared/dates";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createHomeRepository } from "../repositories/homeRepository";
import { createImportantDateRepository } from "../repositories/importantDateRepository";
import { toImportantDate } from "./importantDateService";
import { countUnopenedLetters } from "./letterService";
import { createPlanRepository } from "../repositories/planRepository";
import { PLAN_TYPE_INFO } from "@shared/plans";
import { createRelationshipRepository } from "../repositories/relationshipRepository";
import { notFound } from "../utils/errors";

export function anniversaryMoment(relationship: RelationshipSummary, today: string): UpcomingMoment {
  const next = nextYearlyOccurrence(relationship.startedOn, today);
  return {
    title: next.years === 1 ? "Nuestro primer aniversario" : "Nuestro aniversario",
    emoji: "💞",
    date: next.date,
    daysUntil: daysBetween(today, next.date),
    years: next.years,
    link: "/nosotros",
  };
}

export async function getHome(env: Bindings, user: AuthenticatedUser): Promise<HomeResponse> {
  // requireRelationship garantiza que existe; la comprobación es por si se usa sin ese middleware.
  if (!user.relationshipId) throw notFound("Relación no configurada");

  const homeRepository = createHomeRepository(env.DB);
  const [relationship, importantDates, highlightedMemory, unopenedLetters] = await Promise.all([
    createRelationshipRepository(env.DB).findSummary(user.relationshipId),
    createImportantDateRepository(env.DB).list(user.relationshipId),
    homeRepository.findHighlightedMemory(user.relationshipId),
    countUnopenedLetters(env, user),
  ]);
  if (!relationship) throw notFound("Relación no encontrada");

  // "Hoy" es el de la zona horaria de la pareja, no el del servidor.
  const today = todayIn(relationship.timezone);
  const { years, months } = elapsedParts(relationship.startedOn, today);

  const upcomingPlans = await createPlanRepository(env.DB).listUpcoming(user.relationshipId, today);

  const candidates: UpcomingMoment[] = [
    anniversaryMoment(relationship, today),
    ...importantDates
      .map((row) => toImportantDate(row, today))
      .filter((date) => date.nextDate !== null && date.daysUntil !== null)
      .map(
        (date): UpcomingMoment => ({
          title: date.title,
          emoji: date.emoji,
          date: date.nextDate!,
          daysUntil: date.daysUntil!,
          years: date.years,
          link: "/nosotros",
        }),
      ),
    ...upcomingPlans.map(
      (plan): UpcomingMoment => ({
        title: plan.title,
        emoji: PLAN_TYPE_INFO[plan.plan_type].emoji,
        date: plan.planned_for,
        daysUntil: daysBetween(today, plan.planned_for),
        years: null,
        link: `/planes/${plan.id}`,
      }),
    ),
  ];
  // Estable: a igual distancia, el aniversario y las fechas importantes van antes que un plan.
  candidates.sort((a, b) => a.daysUntil - b.daysUntil);

  return {
    relationship,
    today,
    together: { days: daysBetween(relationship.startedOn, today), years, months },
    nextMoment: candidates[0] ?? null,
    highlightedMemory,
    unopenedLetters,
  };
}
