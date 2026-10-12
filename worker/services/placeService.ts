import type {
  GeocodeResponse,
  PlacePreferencesResponse,
  PlaceRecommendationsResponse,
  PlaceStatus,
  SavedPlacesResponse,
} from "@shared/api";
import type { PlaceCategory } from "@shared/places";
import type { PlaceInteractionInput, PlacePreferencesInput, PlaceSearchInput } from "@shared/schemas";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createPlaceRepository } from "../repositories/placeRepository";
import { createRelationshipRepository } from "../repositories/relationshipRepository";
import { badRequest, notFound } from "../utils/errors";
import { createPlacesClient, type PlacesClient } from "./places/googlePlaces";
import { resolveIntent } from "./places/intent";
import { affinityFromCounts, rankPlaces } from "./places/recommender";

/** Si no pidieron nada concreto ni tienen gustos guardados: planes de pareja típicos. */
const DEFAULT_CATEGORIES: PlaceCategory[] = ["cafe", "dessert", "park", "viewpoint"];
/** searchNearby no admite más de 50 tipos; con 4 categorías sobra. */
const MAX_NEARBY_CATEGORIES = 4;
const SAVED_LIMIT = 20;

export interface PlaceDeps {
  places?: PlacesClient;
}

const clientFor = (env: Bindings, deps: PlaceDeps) => deps.places ?? createPlacesClient(env.GOOGLE_PLACES_API_KEY);

async function partnerOf(env: Bindings, user: AuthenticatedUser) {
  const summary = await createRelationshipRepository(env.DB).findSummary(user.relationshipId!);
  return summary?.members.find((member) => member.id !== user.id) ?? null;
}

export async function recommendPlaces(
  env: Bindings,
  user: AuthenticatedUser,
  input: PlaceSearchInput,
  deps: PlaceDeps = {},
): Promise<PlaceRecommendationsResponse> {
  const repo = createPlaceRepository(env.DB);
  const relationshipId = user.relationshipId!;
  const partner = await partnerOf(env, user);
  const [mine, partnerPrefs, counts] = await Promise.all([
    repo.getPreferences(user.id),
    partner ? repo.getPreferences(partner.id) : Promise.resolve(null),
    repo.categoryCounts(relationshipId),
  ]);

  // Por defecto: lo que les gusta a los dos (sin lo que a alguno no le gusta).
  const disliked = new Set([...mine.dislikedCategories, ...(partnerPrefs?.dislikedCategories ?? [])]);
  const liked = [...new Set([...mine.likedCategories, ...(partnerPrefs?.likedCategories ?? [])])].filter((c) => !disliked.has(c));
  const intent = resolveIntent(input, {
    categories: liked.length > 0 ? liked.slice(0, MAX_NEARBY_CATEGORIES) : DEFAULT_CATEGORIES,
    budget: mine.budgetMax,
    maxDistanceKm: mine.maxDistanceKm,
    dietary: [...new Set([...mine.dietary, ...(partnerPrefs?.dietary ?? [])])],
  });

  // Con una comida concreta o una restricción alimentaria, búsqueda por texto; si no, por cercanía y tipo.
  const client = clientFor(env, deps);
  const radiusM = intent.maxDistanceKm * 1000;
  const textMatched = intent.food !== null || (intent.dietary.length > 0 && intent.categories.includes("restaurant"));
  const candidates = textMatched
    ? await client.searchText({
        text: [intent.food ?? "restaurante", ...intent.dietary].join(" "),
        location: input.location,
        radiusM,
        openNow: intent.openNow,
        budget: intent.budget,
      })
    : await client.searchNearby({ location: input.location, radiusM, categories: intent.categories.slice(0, MAX_NEARBY_CATEGORIES) });

  const statusByPlace = await repo.statusFor(relationshipId, user.id, [...new Set(candidates.map((place) => place.id))]);
  const items = rankPlaces(
    candidates,
    intent,
    {
      mine,
      partner: partnerPrefs,
      partnerName: partner?.displayName ?? null,
      statusByPlace,
      affinity: affinityFromCounts(counts),
    },
    { textMatched },
  );
  return { understood: intent, items, candidates: candidates.length };
}

export async function setPlaceInteraction(
  env: Bindings,
  user: AuthenticatedUser,
  placeId: string,
  input: PlaceInteractionInput,
): Promise<PlaceStatus> {
  const repo = createPlaceRepository(env.DB);
  await repo.setInteraction({
    relationshipId: user.relationshipId!,
    userId: user.id,
    placeId,
    type: input.type,
    active: input.active,
    category: input.category ?? null,
  });
  const status = await repo.statusFor(user.relationshipId!, user.id, [placeId]);
  return status.get(placeId) ?? { mine: [], partner: [] };
}

/** Los guardados con sus datos actuales de Google (se piden en el momento, no se guardan). */
export async function listSavedPlaces(
  env: Bindings,
  user: AuthenticatedUser,
  origin: { lat: number; lng: number } | null,
  deps: PlaceDeps = {},
): Promise<SavedPlacesResponse> {
  const rows = await createPlaceRepository(env.DB).listSaved(user.relationshipId!, user.id, SAVED_LIMIT);
  if (rows.length === 0) return { items: [] };
  const client = clientFor(env, deps);
  const places = await Promise.all(rows.map((row) => client.details(row.placeId, origin)));
  return {
    items: rows.map((row, index) => ({
      placeId: row.placeId,
      place: places[index] ?? null,
      category: row.category ?? places[index]?.category ?? null,
      status: row.status,
      lastInteractionAt: row.lastInteractionAt,
    })),
  };
}

export async function getPlacePreferences(env: Bindings, user: AuthenticatedUser): Promise<PlacePreferencesResponse> {
  const repo = createPlaceRepository(env.DB);
  const partner = await partnerOf(env, user);
  const [mine, partnerPrefs] = await Promise.all([
    repo.getPreferences(user.id),
    partner ? repo.getPreferences(partner.id) : Promise.resolve(null),
  ]);
  return {
    mine,
    partner: partner && partnerPrefs ? { displayName: partner.displayName, preferences: partnerPrefs } : null,
  };
}

export async function savePlacePreferences(env: Bindings, user: AuthenticatedUser, input: PlacePreferencesInput) {
  const overlap = input.likedCategories.filter((category) => input.dislikedCategories.includes(category));
  if (overlap.length > 0) throw badRequest("Una categoría no puede gustarte y no gustarte a la vez");
  await createPlaceRepository(env.DB).savePreferences(user.id, input);
  return getPlacePreferences(env, user);
}

export async function geocode(env: Bindings, text: string, deps: PlaceDeps = {}): Promise<GeocodeResponse> {
  const result = await clientFor(env, deps).geocode(text);
  if (!result) throw notFound("No encontramos esa zona");
  return result;
}
