// "¿Qué hacemos hoy?": categorías, ambientes y presupuestos propios de la app.
// Son independientes de Google: el Worker traduce cada categoría a los tipos de Google Places.

export const PLACE_CATEGORIES = ["cafe", "dessert", "restaurant", "bar", "park", "culture", "cinema", "viewpoint", "activity"] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const PLACE_CATEGORY_INFO: Record<PlaceCategory, { label: string; emoji: string }> = {
  cafe: { label: "Café", emoji: "☕" },
  dessert: { label: "Postres y helados", emoji: "🍰" },
  restaurant: { label: "Comer", emoji: "🍽️" },
  bar: { label: "Un trago", emoji: "🍹" },
  park: { label: "Aire libre", emoji: "🌳" },
  culture: { label: "Museos y cultura", emoji: "🏛️" },
  cinema: { label: "Cine", emoji: "🎬" },
  viewpoint: { label: "Miradores", emoji: "🌅" },
  activity: { label: "Algo divertido", emoji: "🎳" },
};

export const AMBIENCES = ["tranquilo", "romántico", "animado", "aire libre"] as const;
export type Ambience = (typeof AMBIENCES)[number];

/** Ambiente que suele tener cada categoría (no hay un dato real de "ambiente" en Google). */
export const CATEGORY_AMBIENCE: Record<PlaceCategory, readonly Ambience[]> = {
  cafe: ["tranquilo", "romántico"],
  dessert: ["tranquilo"],
  restaurant: ["romántico", "animado"],
  bar: ["animado", "romántico"],
  park: ["tranquilo", "aire libre"],
  culture: ["tranquilo"],
  cinema: ["romántico"],
  viewpoint: ["romántico", "aire libre", "tranquilo"],
  activity: ["animado"],
};

/** Presupuesto: 1 = económico, 2 = moderado, 3 = caro, 4 = muy caro (la escala de Google). */
export const BUDGET_LABELS: Record<1 | 2 | 3 | 4, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

export const DISTANCE_OPTIONS_KM = [1, 3, 5, 10, 20] as const;
export const DEFAULT_DISTANCE_KM = 5;
/** Máximo de resultados que se muestran. */
export const TOP_RESULTS = 5;

export const PLACE_INTERACTIONS = ["interested", "not_interested", "favorite", "visited", "loved"] as const;
export type PlaceInteractionType = (typeof PLACE_INTERACTIONS)[number];

export const PLACE_INTERACTION_INFO: Record<PlaceInteractionType, { label: string; emoji: string }> = {
  interested: { label: "Me interesa", emoji: "👀" },
  not_interested: { label: "No me interesa", emoji: "🙅" },
  favorite: { label: "Favorito", emoji: "⭐" },
  visited: { label: "Fuimos aquí", emoji: "📍" },
  loved: { label: "Nos encantó", emoji: "💖" },
};

/** Marcas que se quitan al poner otra ("Fuimos aquí" puede convivir con "No me interesa": no volverían). */
export function conflictingWith(type: PlaceInteractionType): PlaceInteractionType[] {
  if (type === "not_interested") return ["interested", "favorite", "loved"];
  return type === "visited" ? [] : ["not_interested"];
}
