import type { RelationshipSummary, TimelineEvent, TimelineResponse, UsResponse } from "@shared/api";
import { daysBetween, elapsedParts, todayIn, utcToZoned } from "@shared/dates";
import { PLAN_TYPE_INFO } from "@shared/plans";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import type { ImportantDateRow } from "../repositories/importantDateRepository";
import { createImportantDateRepository } from "../repositories/importantDateRepository";
import { createMemoryRepository } from "../repositories/memoryRepository";
import { createRelationshipRepository } from "../repositories/relationshipRepository";
import { createUsRepository, type TimelineMemoryRow, type TimelinePlanRow } from "../repositories/usRepository";
import { notFound } from "../utils/errors";
import { anniversaryMoment } from "./homeService";
import { sortImportantDates, toImportantDate } from "./importantDateService";

const FAVORITES_SHOWN = 12;

/** La relación de quien pregunta y el "hoy" en su zona horaria. */
export async function loadRelationship(env: Bindings, user: AuthenticatedUser): Promise<{ relationship: RelationshipSummary; today: string }> {
  const relationship = await createRelationshipRepository(env.DB).findSummary(user.relationshipId!);
  if (!relationship) throw notFound("Relación no encontrada");
  return { relationship, today: todayIn(relationship.timezone) };
}

export async function getUs(env: Bindings, user: AuthenticatedUser): Promise<UsResponse> {
  const { relationship, today } = await loadRelationship(env, user);
  const relationshipId = relationship.id;
  const [stats, dates, favorites] = await Promise.all([
    createUsRepository(env.DB).stats(relationshipId),
    createImportantDateRepository(env.DB).list(relationshipId),
    createMemoryRepository(env.DB).listCoupleFavorites(user.id, relationshipId, FAVORITES_SHOWN),
  ]);
  const days = daysBetween(relationship.startedOn, today);
  const { years, months } = elapsedParts(relationship.startedOn, today);

  return {
    relationship,
    today,
    together: { days, years, months },
    stats: {
      daysTogether: days,
      memories: stats.memories,
      photos: stats.photos,
      places: stats.places,
      plansDone: stats.plans_done,
      lettersOpened: stats.letters_opened,
      favorites: stats.favorites,
    },
    anniversary: anniversaryMoment(relationship, today),
    importantDates: sortImportantDates(dates.map((row) => toImportantDate(row, today))),
    favorites,
  };
}

const coverOf = (row: { cover_id: string | null; cover_width: number | null; cover_height: number | null }) =>
  row.cover_id ? { id: row.cover_id, width: row.cover_width, height: row.cover_height } : null;

/** Orden dentro del mismo día: el inicio y los aniversarios primero, luego lo demás. */
const KIND_ORDER: Record<TimelineEvent["kind"], number> = { start: 0, anniversary: 1, date: 2, plan: 3, memory: 4 };

export interface TimelineSources {
  relationship: Pick<RelationshipSummary, "startedOn" | "timezone">;
  today: string;
  memories: TimelineMemoryRow[];
  plans: TimelinePlanRow[];
  dates: ImportantDateRow[];
}

/** Arma la historia de la pareja, del principio a hoy. Función pura para poder probarla. */
export function buildTimeline({ relationship, today, memories, plans, dates }: TimelineSources): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { key: "start", kind: "start", date: relationship.startedOn, title: "Empezamos", subtitle: null, emoji: "💗", link: null, cover: null },
  ];

  // Cada aniversario ya cumplido.
  const [startYear] = relationship.startedOn.split("-").map(Number);
  const [todayYear] = today.split("-").map(Number);
  for (let year = startYear! + 1; year <= todayYear!; year++) {
    const n = year - startYear!;
    // 29/02 en años no bisiestos → 28/02 (igual que en el inicio).
    const date = `${year}-${relationship.startedOn.slice(5)}`;
    const valid = new Date(`${date}T00:00:00Z`).toISOString().startsWith(date) ? date : `${year}-02-28`;
    if (valid > today) break;
    events.push({
      key: `anniversary-${n}`,
      kind: "anniversary",
      date: valid,
      title: n === 1 ? "Nuestro primer aniversario" : `${n} años juntos`,
      subtitle: null,
      emoji: "💞",
      link: null,
      cover: null,
    });
  }

  for (const memory of memories) {
    events.push({
      key: `memory-${memory.id}`,
      kind: "memory",
      date: memory.happened_on,
      title: memory.title,
      subtitle: memory.place_name,
      emoji: "📸",
      link: `/recuerdos/${memory.id}`,
      cover: coverOf(memory),
    });
  }

  for (const plan of plans) {
    const completedOn = utcToZoned(plan.completed_at, relationship.timezone).date;
    events.push({
      key: `plan-${plan.id}`,
      kind: "plan",
      date: plan.planned_for && plan.planned_for <= completedOn ? plan.planned_for : completedOn,
      title: plan.title,
      subtitle: plan.place_name,
      emoji: PLAN_TYPE_INFO[plan.plan_type].emoji,
      link: `/planes/${plan.id}`,
      cover: coverOf(plan),
    });
  }

  // Fechas importantes ya ocurridas (los cumpleaños no: su fecha original es el nacimiento).
  for (const row of dates) {
    if (row.date_type === "birthday" || row.event_date > today) continue;
    const date = toImportantDate(row, today);
    events.push({ key: `date-${row.id}`, kind: "date", date: row.event_date, title: row.title, subtitle: row.notes, emoji: date.emoji, link: null, cover: null });
  }

  return events
    .filter((event) => event.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

export async function getTimeline(env: Bindings, user: AuthenticatedUser): Promise<TimelineResponse> {
  const { relationship, today } = await loadRelationship(env, user);
  const [{ memories, plans }, dates] = await Promise.all([
    createUsRepository(env.DB).timelineSources(relationship.id),
    createImportantDateRepository(env.DB).list(relationship.id),
  ]);
  return { today, events: buildTimeline({ relationship, today, memories, plans, dates }) };
}
