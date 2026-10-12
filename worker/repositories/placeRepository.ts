import type { PlacePreferences, PlaceStatus } from "@shared/api";
import { AMBIENCES, PLACE_CATEGORIES, PLACE_INTERACTIONS, conflictingWith, type PlaceCategory, type PlaceInteractionType } from "@shared/places";
import { DIETARY_OPTIONS, type PlacePreferencesInput } from "@shared/schemas";

// Lo único que se guarda de "¿Qué hacemos hoy?": Place IDs de Google con lo que cada uno marcó,
// y los gustos de cada persona. Nada de nombres, direcciones ni ratings de Google.

interface PreferencesRow {
  max_distance_km: number | null;
  price_level_max: number | null;
  liked_categories: string;
  disliked_categories: string;
  ambience: string;
  dietary: string;
}

export const EMPTY_PREFERENCES: PlacePreferences = {
  maxDistanceKm: null,
  budgetMax: null,
  likedCategories: [],
  dislikedCategories: [],
  ambience: [],
  dietary: [],
};

/** Lee una lista JSON quedándose solo con valores conocidos (la tabla de 0001 acepta cualquier texto). */
function parseList<T extends string>(json: string, allowed: readonly T[]): T[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((item): item is T => allowed.includes(item as T)) : [];
  } catch {
    return [];
  }
}

function toPreferences(row: PreferencesRow | null): PlacePreferences {
  if (!row) return EMPTY_PREFERENCES;
  return {
    maxDistanceKm: row.max_distance_km,
    budgetMax: row.price_level_max !== null && row.price_level_max >= 1 ? row.price_level_max : null,
    likedCategories: parseList(row.liked_categories, PLACE_CATEGORIES),
    dislikedCategories: parseList(row.disliked_categories, PLACE_CATEGORIES),
    ambience: parseList(row.ambience, AMBIENCES),
    dietary: parseList(row.dietary, DIETARY_OPTIONS),
  };
}

interface InteractionRow {
  user_id: string;
  google_place_id: string;
  interaction_type: PlaceInteractionType;
  category: PlaceCategory | null;
  created_at: string;
}

export interface SavedPlaceRow {
  placeId: string;
  category: PlaceCategory | null;
  status: PlaceStatus;
  lastInteractionAt: string;
}

/** Interacciones que se muestran como estado (la tabla de 0001 también admite 'rated'). */
const SHOWN = PLACE_INTERACTIONS.map((type) => `'${type}'`).join(", ");

function groupStatus(rows: InteractionRow[], userId: string): Map<string, PlaceStatus> {
  const byPlace = new Map<string, PlaceStatus>();
  for (const row of rows) {
    const status = byPlace.get(row.google_place_id) ?? { mine: [], partner: [] };
    (row.user_id === userId ? status.mine : status.partner).push(row.interaction_type);
    byPlace.set(row.google_place_id, status);
  }
  return byPlace;
}

export function createPlaceRepository(db: D1Database) {
  return {
    async getPreferences(userId: string): Promise<PlacePreferences> {
      const row = await db
        .prepare(
          `SELECT max_distance_km, price_level_max, liked_categories, disliked_categories, ambience, dietary
           FROM user_preferences WHERE user_id = ?1`,
        )
        .bind(userId)
        .first<PreferencesRow>();
      return toPreferences(row);
    },

    async savePreferences(userId: string, input: PlacePreferencesInput): Promise<void> {
      await db
        .prepare(
          `INSERT INTO user_preferences (user_id, max_distance_km, price_level_max, liked_categories, disliked_categories, ambience, dietary)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT (user_id) DO UPDATE SET
             max_distance_km = excluded.max_distance_km, price_level_max = excluded.price_level_max,
             liked_categories = excluded.liked_categories, disliked_categories = excluded.disliked_categories,
             ambience = excluded.ambience, dietary = excluded.dietary,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .bind(
          userId,
          input.maxDistanceKm,
          input.budgetMax,
          JSON.stringify([...new Set(input.likedCategories)]),
          JSON.stringify([...new Set(input.dislikedCategories)]),
          JSON.stringify([...new Set(input.ambience)]),
          JSON.stringify([...new Set(input.dietary)]),
        )
        .run();
    },

    /** Qué marcó cada uno en estos lugares. */
    async statusFor(relationshipId: string, userId: string, placeIds: string[]): Promise<Map<string, PlaceStatus>> {
      if (placeIds.length === 0) return new Map();
      const placeholders = placeIds.map((_, index) => `?${index + 2}`).join(", ");
      const { results } = await db
        .prepare(
          `SELECT user_id, google_place_id, interaction_type, category, created_at FROM place_interactions
           WHERE relationship_id = ?1 AND interaction_type IN (${SHOWN}) AND google_place_id IN (${placeholders})`,
        )
        .bind(relationshipId, ...placeIds)
        .all<InteractionRow>();
      return groupStatus(results, userId);
    },

    /** Cuántas veces la pareja marcó cada tipo de interacción en cada categoría. */
    async categoryCounts(relationshipId: string) {
      const { results } = await db
        .prepare(
          `SELECT category, interaction_type AS type, COUNT(*) AS total FROM place_interactions
           WHERE relationship_id = ?1 AND category IS NOT NULL AND interaction_type IN (${SHOWN})
           GROUP BY category, interaction_type`,
        )
        .bind(relationshipId)
        .all<{ category: PlaceCategory; type: PlaceInteractionType; total: number }>();
      return results;
    },

    /** Marca o desmarca. "No me interesa" se excluye con me interesa, favorito y nos encantó. */
    async setInteraction(params: {
      relationshipId: string;
      userId: string;
      placeId: string;
      type: PlaceInteractionType;
      active: boolean;
      category: PlaceCategory | null;
    }): Promise<void> {
      const { relationshipId, userId, placeId, type, active, category } = params;
      const remove = (kind: PlaceInteractionType) =>
        db
          .prepare("DELETE FROM place_interactions WHERE user_id = ?1 AND google_place_id = ?2 AND interaction_type = ?3")
          .bind(userId, placeId, kind);

      if (!active) {
        await remove(type).run();
        return;
      }
      await db.batch([
        ...conflictingWith(type).map(remove),
        db
          .prepare(
            `INSERT INTO place_interactions (id, relationship_id, user_id, google_place_id, interaction_type, category)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT (user_id, google_place_id, interaction_type)
             DO UPDATE SET category = COALESCE(excluded.category, place_interactions.category)`,
          )
          .bind(crypto.randomUUID(), relationshipId, userId, placeId, type, category),
      ]);
    },

    /** Lugares guardados por la pareja (cualquier marca menos "no me interesa"), lo más reciente primero. */
    async listSaved(relationshipId: string, userId: string, limit: number): Promise<SavedPlaceRow[]> {
      const { results } = await db
        .prepare(
          `SELECT user_id, google_place_id, interaction_type, category, created_at FROM place_interactions
           WHERE relationship_id = ?1 AND interaction_type IN (${SHOWN}) AND google_place_id IN (
             SELECT google_place_id FROM place_interactions
             WHERE relationship_id = ?1 AND interaction_type IN ('interested', 'favorite', 'visited', 'loved')
             GROUP BY google_place_id ORDER BY MAX(created_at) DESC LIMIT ?2
           )`,
        )
        .bind(relationshipId, limit)
        .all<InteractionRow>();

      const status = groupStatus(results, userId);
      const meta = new Map<string, { category: PlaceCategory | null; last: string }>();
      for (const row of results) {
        const current = meta.get(row.google_place_id);
        meta.set(row.google_place_id, {
          category: current?.category ?? row.category,
          last: current && current.last > row.created_at ? current.last : row.created_at,
        });
      }
      return [...meta.entries()]
        .map(([placeId, { category, last }]) => ({ placeId, category, status: status.get(placeId)!, lastInteractionAt: last }))
        .sort((a, b) => b.lastInteractionAt.localeCompare(a.lastInteractionAt));
    },
  };
}
