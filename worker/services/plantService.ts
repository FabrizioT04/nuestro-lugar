import type { PlantResponse } from "@shared/api";
import { daysBetween } from "@shared/dates";
import { daysToNextStage, flowerCount, plantMood, plantStage } from "@shared/plant";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createPlantRepository } from "../repositories/plantRepository";
import { loadRelationship } from "./usService";

export async function getPlant(env: Bindings, user: AuthenticatedUser): Promise<PlantResponse> {
  const { relationship, today } = await loadRelationship(env, user);
  const repository = createPlantRepository(env.DB);
  const plant = await repository.findOrPlant(relationship.id, today);
  const [care, waterers] = await Promise.all([repository.care(relationship.id), repository.waterersOn(relationship.id, today)]);
  const stage = plantStage(care.care_days);
  const daysSinceWater = care.last_day ? Math.max(0, daysBetween(care.last_day, today)) : null;
  const partner = relationship.members.find((member) => member.id !== user.id);
  return {
    name: plant.name,
    plantedOn: plant.planted_on,
    today,
    careDays: care.care_days,
    stage: { index: stage.index, name: stage.name },
    daysToNextStage: daysToNextStage(care.care_days),
    flowers: flowerCount(care.care_days),
    mood: plantMood(daysSinceWater),
    daysSinceWater,
    wateredToday: { me: waterers.includes(user.id), partner: partner ? waterers.includes(partner.id) : false },
    partnerName: partner?.displayName ?? "tu pareja",
  };
}

/** Riega la plantita (una vez al día por persona; repetir no hace nada). */
export async function waterPlant(env: Bindings, user: AuthenticatedUser): Promise<PlantResponse> {
  const { relationship, today } = await loadRelationship(env, user);
  const repository = createPlantRepository(env.DB);
  await repository.findOrPlant(relationship.id, today);
  await repository.water(relationship.id, user.id, today);
  return getPlant(env, user);
}

export async function renamePlant(env: Bindings, user: AuthenticatedUser, name: string): Promise<PlantResponse> {
  const { relationship, today } = await loadRelationship(env, user);
  const repository = createPlantRepository(env.DB);
  await repository.findOrPlant(relationship.id, today);
  await repository.rename(relationship.id, name);
  return getPlant(env, user);
}
