import type { PlanDetail, PlanListResponse, PlanStatusName, PlanTypeName } from "@shared/api";
import { todayIn } from "@shared/dates";
import type { MemoryInput, PlanInput } from "@shared/schemas";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createMediaRepository } from "../repositories/mediaRepository";
import { createMemoryRepository } from "../repositories/memoryRepository";
import { createPlanRepository } from "../repositories/planRepository";
import { createRelationshipRepository } from "../repositories/relationshipRepository";
import { badRequest, conflict, notFound } from "../utils/errors";

const relationshipOf = (user: AuthenticatedUser) => user.relationshipId!;

/** Categoría de recuerdo que corresponde a cada tipo de plan (ver MEMORY_CATEGORIES). */
export const MEMORY_CATEGORY_FOR_PLAN: Record<PlanTypeName, string | null> = {
  date: "Cita",
  restaurant: "Comida",
  trip: "Viaje",
  activity: "Paseo",
  movie: "En casa",
  goal: "Especial",
  place_to_visit: "Paseo",
  other: null,
};

/** Las fotos deben existir, ser de esta relación y haberse subido para un plan. */
async function assertPhotosOwned(env: Bindings, user: AuthenticatedUser, photoIds: string[]) {
  if (photoIds.length === 0) return;
  const owned = await createMediaRepository(env.DB).countOwned(photoIds, relationshipOf(user), ["plan"]);
  if (owned !== photoIds.length) throw badRequest("Alguna foto no existe o no es de este lugar");
}

async function requirePlan(env: Bindings, user: AuthenticatedUser, planId: string): Promise<PlanDetail> {
  const plan = await createPlanRepository(env.DB).findDetail(relationshipOf(user), planId);
  if (!plan) throw notFound("Plan no encontrado");
  return plan;
}

export async function listPlans(env: Bindings, user: AuthenticatedUser): Promise<PlanListResponse> {
  return { items: await createPlanRepository(env.DB).list(relationshipOf(user)) };
}

export const getPlan = requirePlan;

export async function createPlan(env: Bindings, user: AuthenticatedUser, input: PlanInput & { id?: string }): Promise<PlanDetail> {
  await assertPhotosOwned(env, user, input.photoIds);
  const planId = input.id ?? crypto.randomUUID();
  try {
    await createPlanRepository(env.DB).create(planId, relationshipOf(user), user.id, input);
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed: plans.id")) throw conflict("Este plan ya existe");
    throw err;
  }
  return requirePlan(env, user, planId);
}

export async function updatePlan(env: Bindings, user: AuthenticatedUser, planId: string, input: PlanInput): Promise<PlanDetail> {
  const repository = createPlanRepository(env.DB);
  // Los planes son compartidos: los dos pueden editarlos, pero nada fuera de su relación.
  if (!(await repository.exists(relationshipOf(user), planId))) throw notFound("Plan no encontrado");
  await assertPhotosOwned(env, user, input.photoIds);
  await repository.update(planId, relationshipOf(user), input);
  return requirePlan(env, user, planId);
}

export async function setPlanStatus(env: Bindings, user: AuthenticatedUser, planId: string, status: PlanStatusName): Promise<PlanDetail> {
  const repository = createPlanRepository(env.DB);
  if (!(await repository.exists(relationshipOf(user), planId))) throw notFound("Plan no encontrado");
  await repository.setStatus(planId, relationshipOf(user), status);
  return requirePlan(env, user, planId);
}

export async function deletePlan(env: Bindings, user: AuthenticatedUser, planId: string): Promise<void> {
  const repository = createPlanRepository(env.DB);
  if (!(await repository.exists(relationshipOf(user), planId))) throw notFound("Plan no encontrado");
  await repository.softDelete(relationshipOf(user), planId);
}

/** Datos del recuerdo que nace de un plan realizado. La fecha nunca queda en el futuro. */
export function memoryFromPlan(plan: PlanDetail, today: string): MemoryInput {
  return {
    title: plan.title,
    description: plan.description,
    happenedOn: plan.plannedFor && plan.plannedFor <= today ? plan.plannedFor : today,
    category: MEMORY_CATEGORY_FOR_PLAN[plan.type],
    placeName: plan.placeName,
    tags: [],
    photoIds: plan.photos.map((photo) => photo.id),
    isHighlighted: false,
  };
}

/**
 * Convierte un plan realizado en recuerdo (comparten las fotos). Si ya se convirtió y el recuerdo
 * sigue existiendo, devuelve ese mismo recuerdo en lugar de duplicarlo.
 */
export async function convertPlanToMemory(env: Bindings, user: AuthenticatedUser, planId: string): Promise<{ memoryId: string; created: boolean }> {
  const plan = await requirePlan(env, user, planId);
  if (plan.resultingMemoryId) return { memoryId: plan.resultingMemoryId, created: false };
  if (plan.status !== "done") throw conflict("Primero marca el plan como realizado");

  const relationship = await createRelationshipRepository(env.DB).findSummary(relationshipOf(user));
  if (!relationship) throw notFound("Relación no encontrada");

  const memoryId = crypto.randomUUID();
  const link = createPlanRepository(env.DB).linkMemoryStatement(planId, relationshipOf(user), memoryId);
  await createMemoryRepository(env.DB).create(memoryId, relationshipOf(user), user.id, memoryFromPlan(plan, todayIn(relationship.timezone)), [link]);
  return { memoryId, created: true };
}
