import type { PlaceIntent, PlacePreferences, PlaceRecommendation, PlaceStatus, PlaceSummary } from "@shared/api";
import { CATEGORY_AMBIENCE, PLACE_CATEGORY_INFO, TOP_RESULTS, type PlaceCategory, type PlaceInteractionType } from "@shared/places";

// Recomendador híbrido por reglas: no hay red neuronal ni nada que entrenar.
// Cada candidato de Google recibe un puntaje que suma señales independientes:
//   pedido (categoría, comida, ambiente) · cercanía · rating ponderado por cantidad de reseñas ·
//   precio vs presupuesto · gustos de los dos · historial de la pareja · lo que ya marcaron en ese lugar.
// El puntaje es interno; a la app solo llegan las razones en lenguaje humano.
//
// Preparado para embeddings: `semanticScore` (opcional) permite sumar más adelante la similitud
// entre el pedido y el lugar (Workers AI + Vectorize) sin cambiar el resto.

export interface CoupleContext {
  mine: PlacePreferences;
  partner: PlacePreferences | null;
  partnerName: string | null;
  /** Interacciones de cada uno con estos candidatos, por Place ID. */
  statusByPlace: Map<string, PlaceStatus>;
  /** -1 (no les gusta) … 1 (les encanta), según su historial por categoría. */
  affinity: Partial<Record<PlaceCategory, number>>;
}

export interface RankOptions {
  /** Los candidatos vienen de una búsqueda por texto (ya coinciden con la comida pedida). */
  textMatched: boolean;
  semanticScore?: (place: PlaceSummary) => number;
  limit?: number;
}

const EMPTY_STATUS: PlaceStatus = { mine: [], partner: [] };
/** Rating "neutro" y peso de la media: con pocas reseñas, el rating se acerca a 4,0. */
const PRIOR_RATING = 4.0;
const PRIOR_COUNT = 25;
const MAX_PER_CATEGORY = 2;

/** Cuánto pesa cada interacción al calcular la afinidad por categoría. */
export const AFFINITY_WEIGHTS: Record<PlaceInteractionType, number> = {
  loved: 2,
  favorite: 1.5,
  visited: 0.5,
  interested: 0.5,
  not_interested: -1,
};

export function affinityFromCounts(counts: { category: PlaceCategory; type: PlaceInteractionType; total: number }[]) {
  const sums: Partial<Record<PlaceCategory, number>> = {};
  for (const { category, type, total } of counts) sums[category] = (sums[category] ?? 0) + AFFINITY_WEIGHTS[type] * total;
  const affinity: Partial<Record<PlaceCategory, number>> = {};
  for (const [category, sum] of Object.entries(sums) as [PlaceCategory, number][]) affinity[category] = Math.tanh(sum / 4);
  return affinity;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `A ${Math.max(50, Math.round(meters / 50) * 50)} m`;
  return `A ${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

const lower = (category: PlaceCategory) => PLACE_CATEGORY_INFO[category].label.toLowerCase();

interface Scored {
  place: PlaceSummary;
  score: number;
  /** [prioridad, texto]: se muestran las 3 de mayor prioridad. */
  reasons: [number, string][];
  status: PlaceStatus;
}

function scorePlace(place: PlaceSummary, intent: PlaceIntent, couple: CoupleContext, options: RankOptions): Scored | null {
  const status = couple.statusByPlace.get(place.id) ?? EMPTY_STATUS;
  const reasons: [number, string][] = [];
  let score = 0;

  // Exclusiones duras.
  if (status.mine.includes("not_interested") || status.partner.includes("not_interested")) return null;
  if (intent.openNow && place.openNow === false) return null;
  const maxM = intent.maxDistanceKm * 1000;
  // searchText solo "prefiere" el círculo: lo que queda muy lejos se descarta aquí.
  if (place.distanceM !== null && place.distanceM > maxM * 1.25) return null;

  const { category } = place;

  // Lo que pidieron.
  if (options.textMatched) score += 2;
  if (category && intent.categories.includes(category)) score += 3;
  if (category && intent.ambience.some((ambience) => CATEGORY_AMBIENCE[category].includes(ambience))) {
    score += 1;
    const match = intent.ambience.find((ambience) => CATEGORY_AMBIENCE[category].includes(ambience))!;
    reasons.push([5, `Suele ser ${match === "aire libre" ? "al aire libre" : match}`]);
  }

  // Cercanía: hasta 2 puntos, decrece lineal hasta el máximo.
  if (place.distanceM !== null) {
    score += 2 * (1 - Math.min(1, place.distanceM / maxM));
    reasons.push([place.distanceM <= maxM / 2 ? 6 : 3, formatDistance(place.distanceM)]);
  }

  // Calidad: rating ponderado por cantidad de reseñas (media bayesiana).
  if (place.rating !== null) {
    const count = place.ratingCount ?? 0;
    const weighted = (place.rating * count + PRIOR_RATING * PRIOR_COUNT) / (count + PRIOR_COUNT);
    score += (weighted - PRIOR_RATING) * 3;
    if (place.rating >= 4.3 && count >= 20) reasons.push([5, `★ ${place.rating.toFixed(1).replace(".", ",")}`]);
  }

  // Precio frente al presupuesto (pedido o, si no, el máximo de sus gustos).
  const budget = intent.budget ?? couple.mine.budgetMax;
  if (budget !== null && place.priceLevel !== null) {
    if (place.priceLevel > budget) score -= 2 * (place.priceLevel - budget);
    else {
      score += 0.5;
      if (intent.budget !== null) reasons.push([4, place.priceLevel === 0 ? "Gratis" : "Dentro del presupuesto"]);
    }
  }

  if (intent.openNow && place.openNow) {
    score += 0.5;
    reasons.push([4, "Abierto ahora"]);
  }

  // Gustos de los dos.
  if (category) {
    const people = [couple.mine, couple.partner].filter((prefs): prefs is PlacePreferences => prefs !== null);
    const likes = people.filter((prefs) => prefs.likedCategories.includes(category)).length;
    const dislikes = people.filter((prefs) => prefs.dislikedCategories.includes(category)).length;
    score += 1.5 * likes - 3 * dislikes;
    if (likes === 2) reasons.push([8, `A los dos les gusta: ${lower(category)}`]);
    else if (likes === 1 && couple.partner?.likedCategories.includes(category) && couple.partnerName) {
      reasons.push([6, `A ${couple.partnerName} le gusta: ${lower(category)}`]);
    }

    const affinity = couple.affinity[category] ?? 0;
    score += 2 * affinity;
    if (affinity >= 0.5 && likes < 2) reasons.push([7, `Les suele encantar: ${lower(category)}`]);
  }

  // Lo que ya marcaron en este lugar.
  const both = [...status.mine, ...status.partner];
  if (both.includes("loved")) {
    score += 2;
    reasons.push([9, "Les encantó"]);
  } else if (both.includes("visited")) {
    score -= 0.5;
    reasons.push([2, "Ya fueron"]);
  } else {
    reasons.push([1, "Nuevo para ustedes"]);
  }
  if (both.includes("favorite")) {
    score += 1.5;
    reasons.push([8, "Está en sus favoritos"]);
  }
  if (status.partner.includes("interested") && couple.partnerName) {
    score += 1;
    reasons.push([9, `A ${couple.partnerName} le interesa`]);
  } else if (status.mine.includes("interested")) {
    score += 0.5;
  }

  if (options.semanticScore) score += options.semanticScore(place);

  return { place, score, reasons, status };
}

/** Los mejores candidatos, sin repetir demasiado una misma categoría. Función pura. */
export function rankPlaces(candidates: PlaceSummary[], intent: PlaceIntent, couple: CoupleContext, options: RankOptions): PlaceRecommendation[] {
  const limit = options.limit ?? TOP_RESULTS;
  const unique = [...new Map(candidates.map((place) => [place.id, place])).values()];
  const scored = unique
    .map((place) => scorePlace(place, intent, couple, options))
    .filter((item): item is Scored => item !== null)
    .sort((a, b) => b.score - a.score || (a.place.distanceM ?? Infinity) - (b.place.distanceM ?? Infinity));

  // Variedad: si pidieron (o se eligieron) varias categorías, máximo 2 por categoría…
  const diverse = intent.categories.length !== 1 && !options.textMatched;
  const picked: Scored[] = [];
  const perCategory = new Map<string, number>();
  for (const item of scored) {
    if (picked.length >= limit) break;
    const key = item.place.category ?? "other";
    if (diverse && (perCategory.get(key) ?? 0) >= MAX_PER_CATEGORY) continue;
    perCategory.set(key, (perCategory.get(key) ?? 0) + 1);
    picked.push(item);
  }
  // …salvo que no alcance para llenar la lista.
  for (const item of scored) {
    if (picked.length >= limit) break;
    if (!picked.includes(item)) picked.push(item);
  }

  return picked.map(({ place, reasons, status }) => ({
    place,
    reasons: reasons
      .sort((a, b) => b[0] - a[0])
      .slice(0, 3)
      .map(([, text]) => text),
    status,
  }));
}
