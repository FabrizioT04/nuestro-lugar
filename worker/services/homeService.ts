import type { CapsuleSummary, HomeResponse, LetterSummary, PendingItem, RelationshipSummary, UpcomingMoment } from "@shared/api";
import { daysBetween, elapsedParts, nextYearlyOccurrence, todayIn } from "@shared/dates";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createHomeRepository } from "../repositories/homeRepository";
import { createImportantDateRepository } from "../repositories/importantDateRepository";
import { toImportantDate } from "./importantDateService";
import { listPendingCapsules } from "./capsuleService";
import { countUnopenedLetters, listPendingLetters } from "./letterService";
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

const PENDING_LIMIT = 6;

/**
 * Lo que la otra persona dejó para quien mira y que todavía no abrió: primero lo que ya se
 * puede abrir, después lo bloqueado por fecha (lo más cercano antes). Función pura para probarla.
 */
export function pendingItems(letters: LetterSummary[], capsules: CapsuleSummary[]): PendingItem[] {
  const items: PendingItem[] = [
    ...letters
      .filter((letter) => !letter.isMine && letter.openedAt === null)
      .map((letter): PendingItem => ({
        kind: "letter",
        id: letter.id,
        title: letter.title,
        from: letter.author.displayName,
        isLocked: letter.isLocked,
        unlockAt: letter.unlockAt,
      })),
    ...capsules
      .filter((capsule) => !capsule.isMine && capsule.openedAt === null)
      .map((capsule): PendingItem => ({
        kind: "capsule",
        id: capsule.id,
        title: capsule.title,
        from: capsule.author.displayName,
        isLocked: capsule.isLocked,
        unlockAt: capsule.unlockAt,
      })),
  ];
  items.sort((a, b) => Number(a.isLocked) - Number(b.isLocked) || (a.unlockAt ?? "").localeCompare(b.unlockAt ?? ""));
  return items.slice(0, PENDING_LIMIT);
}

export async function getHome(env: Bindings, user: AuthenticatedUser): Promise<HomeResponse> {
  // requireRelationship garantiza que existe; la comprobación es por si se usa sin ese middleware.
  if (!user.relationshipId) throw notFound("Relación no configurada");

  const homeRepository = createHomeRepository(env.DB);
  const [relationship, importantDates, highlightedMemory, unopenedLetters, received, capsules] = await Promise.all([
    createRelationshipRepository(env.DB).findSummary(user.relationshipId),
    createImportantDateRepository(env.DB).list(user.relationshipId),
    homeRepository.findHighlightedMemory(user.relationshipId),
    countUnopenedLetters(env, user),
    listPendingLetters(env, user, PENDING_LIMIT),
    listPendingCapsules(env, user, PENDING_LIMIT),
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
    pending: pendingItems(received, capsules),
  };
}
