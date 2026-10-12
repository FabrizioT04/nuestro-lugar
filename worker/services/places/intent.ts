import type { PlaceIntent } from "@shared/api";
import { DEFAULT_DISTANCE_KM, type Ambience, type PlaceCategory } from "@shared/places";
import type { PlaceSearchInput } from "@shared/schemas";

// Entiende pedidos en lenguaje natural ("Quiero un lugar tranquilo para comer algo dulce y conversar")
// con reglas de palabras clave en español. Es determinista, gratis y no sale del Worker.
// En la fase 11 se puede cambiar por Workers AI manteniendo la misma salida (PlaceIntent).

/** Minúsculas y sin tildes, para comparar sin importar cómo se escriba. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const has = (text: string, words: readonly string[]) => words.some((word) => new RegExp(`\\b${word}`).test(text));

const CATEGORY_WORDS: Record<PlaceCategory, readonly string[]> = {
  cafe: ["cafe", "cafecito", "cafeteria", "coffee", "desayun", "brunch", "lonche"],
  dessert: ["dulce", "postre", "helad", "torta", "pastel", "chocolate", "crepe", "waffle", "churro", "pie\\b", "cheesecake", "donas?\\b"],
  restaurant: ["almorz", "almuerzo", "cenar", "cena\\b", "restaurante"],
  bar: ["trago", "cerveza", "chela", "vino", "coctel", "pisco", "bar\\b", "bares\\b", "brindar"],
  park: ["parque", "aire libre", "caminar", "pasear", "picnic", "naturaleza", "jardin", "playa", "malecon", "bici"],
  culture: ["museo", "arte\\b", "galeria", "cultura", "exposicion", "teatro", "concierto"],
  cinema: ["cine", "pelicula", "peli\\b", "pelis\\b"],
  viewpoint: ["mirador", "atardecer", "vista", "sunset", "puesta de sol"],
  activity: ["bolos", "boliche", "bowling", "escape room", "karaoke", "arcade", "juegos", "divertid", "zoologico", "acuario", "diversiones"],
};

/** Comidas concretas: se buscan por texto en Google ("pizza cerca de aquí"). */
const FOODS = [
  "pizza", "sushi", "ceviche", "hamburguesa", "pasta", "parrilla", "anticucho", "pollo a la brasa", "chifa", "tacos",
  "ramen", "makis", "alitas", "empanadas", "sanguche", "helado", "cafe", "crepes", "waffles", "arabe", "thai", "india", "vegana", "poke",
] as const;

const AMBIENCE_WORDS: Record<Ambience, readonly string[]> = {
  tranquilo: ["tranquil", "calma", "conversar", "charlar", "platicar", "silencio", "relajad", "sin ruido"],
  "romántico": ["romantic", "aniversario", "cita especial", "intimo", "velas"],
  animado: ["animad", "fiesta", "bailar", "musica", "ambiente", "con gente"],
  "aire libre": ["aire libre", "afuera", "al sol", "terraza"],
};

const DIETARY_WORDS: Record<string, readonly string[]> = {
  vegetariano: ["vegetarian"],
  vegano: ["vegan"],
  "sin gluten": ["sin gluten", "celiac"],
};

export interface TextIntent {
  categories: PlaceCategory[];
  budget: number | null;
  maxDistanceKm: number | null;
  openNow: boolean;
  ambience: Ambience[];
  food: string | null;
  dietary: string[];
}

export function parseIntentText(raw: string): TextIntent {
  const text = normalize(raw);
  const categories = (Object.keys(CATEGORY_WORDS) as PlaceCategory[]).filter((category) => has(text, CATEGORY_WORDS[category]));
  // "Comer algo dulce" es un postre; "comer" a secas, un restaurante.
  if (has(text, ["comer", "comida", "hambre"]) && !categories.some((c) => c === "restaurant" || c === "dessert" || c === "cafe")) {
    categories.push("restaurant");
  }
  const food = FOODS.find((item) => text.includes(item)) ?? null;
  if (food && !categories.includes("restaurant") && !categories.includes("dessert") && !categories.includes("cafe")) {
    categories.push(food === "helado" || food === "crepes" || food === "waffles" ? "dessert" : food === "cafe" ? "cafe" : "restaurant");
  }

  let budget: number | null = null;
  if (has(text, ["barat", "economic", "poco dinero", "sin gastar", "no gastar", "gratis", "ahorr"])) budget = 1;
  else if (has(text, ["moderad", "normal de precio"])) budget = 2;
  else if (has(text, ["elegante", "lujo", "fino\\b", "algo especial", "darnos un gusto", "caro"])) budget = 3;

  let maxDistanceKm: number | null = null;
  if (has(text, ["cerquita", "caminando", "a pie", "al lado"])) maxDistanceKm = 1;
  else if (has(text, ["cerca"])) maxDistanceKm = 3;
  else if (has(text, ["no importa (la )?distancia", "lejos"])) maxDistanceKm = 20;

  const openNow = has(text, ["ahora", "ahorita", "ya mismo", "en este momento", "abierto"]);
  const ambience = (Object.keys(AMBIENCE_WORDS) as Ambience[]).filter((name) => has(text, AMBIENCE_WORDS[name]));
  const dietary = Object.keys(DIETARY_WORDS).filter((name) => has(text, DIETARY_WORDS[name]!));

  return { categories, budget, maxDistanceKm, openNow, ambience, food: food === "cafe" ? null : food, dietary };
}

/** Lo elegido en los filtros manda; lo que no se eligió se toma del texto y, si no, de las preferencias. */
export function resolveIntent(
  input: Omit<PlaceSearchInput, "location">,
  defaults: { categories: PlaceCategory[]; budget: number | null; maxDistanceKm: number | null; dietary: string[] },
): PlaceIntent {
  const fromText = input.text ? parseIntentText(input.text) : null;
  const pick = <T>(explicit: T[] | undefined, text: T[] | undefined) => (explicit && explicit.length > 0 ? explicit : (text ?? []));

  const categories = pick(input.categories, fromText?.categories);
  return {
    categories: categories.length > 0 ? categories : defaults.categories,
    budget: input.budget !== undefined ? input.budget : (fromText?.budget ?? defaults.budget),
    maxDistanceKm: input.maxDistanceKm ?? fromText?.maxDistanceKm ?? defaults.maxDistanceKm ?? DEFAULT_DISTANCE_KM,
    openNow: input.openNow ?? fromText?.openNow ?? false,
    ambience: pick(input.ambience, fromText?.ambience),
    food: input.food?.trim() || fromText?.food || null,
    dietary: [...new Set([...(fromText?.dietary ?? []), ...defaults.dietary])],
  };
}
