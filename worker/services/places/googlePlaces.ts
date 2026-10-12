import type { GeoPoint, PlaceSummary } from "@shared/api";
import type { PlaceCategory } from "@shared/places";
import { rateLimited, serviceUnavailable, upstreamError } from "../../utils/errors";

// Cliente mínimo de Google Places API (New). La clave vive solo en el Worker
// (secreto GOOGLE_PLACES_API_KEY); el navegador nunca habla con Google directamente.
//
// Costos: cada llamada cuenta para la cuota diaria configurada en Google Cloud (topes).
// Se piden solo los campos necesarios (FieldMask) y nada de fotos ni reseñas.
// De lo que devuelve Google no se guarda nada en D1 salvo el Place ID.

const BASE_URL = "https://places.googleapis.com/v1";
const TIMEOUT_MS = 8000;
export const MAX_RESULTS = 20;

const PLACE_FIELDS = [
  "id",
  "displayName",
  "shortFormattedAddress",
  "location",
  "types",
  "primaryType",
  "rating",
  "userRatingCount",
  "priceLevel",
  "currentOpeningHours.openNow",
  "googleMapsUri",
  "businessStatus",
];
const SEARCH_FIELD_MASK = PLACE_FIELDS.map((field) => `places.${field}`).join(",");
const DETAILS_FIELD_MASK = PLACE_FIELDS.join(",");

/** Nuestras categorías → tipos de Google (tabla A de Places API New). */
export const GOOGLE_TYPES: Record<PlaceCategory, readonly string[]> = {
  cafe: ["cafe", "coffee_shop"],
  dessert: ["ice_cream_shop", "dessert_shop", "bakery", "confectionery"],
  restaurant: ["restaurant"],
  bar: ["bar", "pub", "wine_bar"],
  park: ["park", "garden"],
  culture: ["museum", "art_gallery", "performing_arts_theater"],
  cinema: ["movie_theater"],
  viewpoint: ["observation_deck", "tourist_attraction"],
  activity: ["bowling_alley", "amusement_center", "zoo", "aquarium", "amusement_park"],
};

// El primer tipo que coincide decide la categoría; los más específicos van antes que "restaurant".
const TYPE_TO_CATEGORY = new Map<string, PlaceCategory>();
for (const category of ["dessert", "cafe", "bar", "cinema", "culture", "activity", "park", "viewpoint", "restaurant"] as const) {
  for (const type of GOOGLE_TYPES[category]) TYPE_TO_CATEGORY.set(type, category);
}

export function categoryFromTypes(primaryType: string | undefined, types: readonly string[] = []): PlaceCategory | null {
  if (primaryType && TYPE_TO_CATEGORY.has(primaryType)) return TYPE_TO_CATEGORY.get(primaryType)!;
  for (const type of types) {
    const category = TYPE_TO_CATEGORY.get(type);
    if (category) return category;
  }
  // Muchos restaurantes vienen como "pizza_restaurant", "sushi_restaurant"...
  if (primaryType?.endsWith("_restaurant") || types.some((type) => type.endsWith("_restaurant"))) return "restaurant";
  return null;
}

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};
const PRICE_ENUM = Object.keys(PRICE_LEVELS);

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  shortFormattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
  businessStatus?: string;
}

/** Distancia en metros (fórmula del haversine). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
}

/** null si le falta lo mínimo o si cerró definitivamente. */
export function toPlaceSummary(raw: GooglePlace, origin: GeoPoint | null): PlaceSummary | null {
  if (!raw.id || !raw.displayName?.text || raw.location?.latitude === undefined || raw.location.longitude === undefined) return null;
  if (raw.businessStatus === "CLOSED_PERMANENTLY") return null;
  const location = { lat: raw.location.latitude, lng: raw.location.longitude };
  return {
    id: raw.id,
    name: raw.displayName.text,
    category: categoryFromTypes(raw.primaryType, raw.types),
    address: raw.shortFormattedAddress ?? null,
    location,
    distanceM: origin ? distanceMeters(origin, location) : null,
    rating: raw.rating ?? null,
    ratingCount: raw.userRatingCount ?? null,
    priceLevel: raw.priceLevel !== undefined ? (PRICE_LEVELS[raw.priceLevel] ?? null) : null,
    openNow: raw.currentOpeningHours?.openNow ?? null,
    mapsUrl: raw.googleMapsUri ?? null,
  };
}

export interface NearbyQuery {
  location: GeoPoint;
  radiusM: number;
  categories: PlaceCategory[];
}

export interface TextQuery {
  text: string;
  location: GeoPoint;
  radiusM: number;
  openNow: boolean;
  /** 1–4: se piden los niveles de precio hasta este. */
  budget: number | null;
}

export interface PlacesClient {
  searchNearby(query: NearbyQuery): Promise<PlaceSummary[]>;
  searchText(query: TextQuery): Promise<PlaceSummary[]>;
  /** null si el Place ID ya no existe. */
  details(placeId: string, origin: GeoPoint | null): Promise<PlaceSummary | null>;
  geocode(text: string): Promise<{ location: GeoPoint; label: string } | null>;
}

/** Google limita el círculo de búsqueda a 50 km. */
const clampRadius = (meters: number) => Math.min(50000, Math.max(100, Math.round(meters)));

export function createPlacesClient(apiKey: string | undefined, fetcher: typeof fetch = fetch): PlacesClient {
  async function call(path: string, fieldMask: string, body?: unknown): Promise<unknown> {
    if (!apiKey) throw serviceUnavailable("La búsqueda de lugares todavía no está activada");
    let response: Response;
    try {
      response = await fetcher(`${BASE_URL}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
          "x-goog-fieldmask": fieldMask,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw upstreamError("No pudimos conectar con Google Maps. Inténtalo de nuevo.");
    }

    if (response.ok) return response.json();
    // El detalle del error de Google puede incluir datos del proyecto: solo va a los logs.
    const detail = await response.text().catch(() => "");
    console.warn(JSON.stringify({ level: "warn", message: "Google Places respondió con error", status: response.status, detail: detail.slice(0, 500) }));
    if (response.status === 404) return null;
    if (response.status === 429) throw rateLimited("Llegamos al tope diario de búsquedas. Mañana se puede de nuevo.");
    if (response.status === 401 || response.status === 403) throw serviceUnavailable("La búsqueda de lugares no está bien configurada");
    if (response.status === 400 && /API_KEY_INVALID|API key not valid/i.test(detail)) {
      throw serviceUnavailable("La búsqueda de lugares no está bien configurada");
    }
    throw upstreamError("Google Maps no respondió bien. Inténtalo de nuevo.");
  }

  const placesOf = (data: unknown, origin: GeoPoint | null) =>
    ((data as { places?: GooglePlace[] } | null)?.places ?? [])
      .map((raw) => toPlaceSummary(raw, origin))
      .filter((place): place is PlaceSummary => place !== null);

  const circle = (location: GeoPoint, radiusM: number) => ({
    circle: { center: { latitude: location.lat, longitude: location.lng }, radius: clampRadius(radiusM) },
  });

  return {
    async searchNearby({ location, radiusM, categories }) {
      const includedTypes = [...new Set(categories.flatMap((category) => GOOGLE_TYPES[category]))];
      const data = await call("/places:searchNearby", SEARCH_FIELD_MASK, {
        includedTypes,
        maxResultCount: MAX_RESULTS,
        rankPreference: "POPULARITY",
        languageCode: "es",
        locationRestriction: circle(location, radiusM),
      });
      return placesOf(data, location);
    },

    async searchText({ text, location, radiusM, openNow, budget }) {
      const data = await call("/places:searchText", SEARCH_FIELD_MASK, {
        textQuery: text,
        pageSize: MAX_RESULTS,
        languageCode: "es",
        locationBias: circle(location, radiusM),
        ...(openNow ? { openNow: true } : {}),
        // El filtro de precio de Google deja fuera los lugares sin precio: solo se usa si hay presupuesto.
        ...(budget ? { priceLevels: PRICE_ENUM.slice(1, budget + 1) } : {}),
      });
      return placesOf(data, location);
    },

    async details(placeId, origin) {
      const data = await call(`/places/${encodeURIComponent(placeId)}?languageCode=es`, DETAILS_FIELD_MASK);
      return data ? toPlaceSummary(data as GooglePlace, origin) : null;
    },

    async geocode(text) {
      const data = await call("/places:searchText", "places.displayName,places.shortFormattedAddress,places.location", {
        textQuery: text,
        pageSize: 1,
        languageCode: "es",
      });
      const raw = (data as { places?: GooglePlace[] } | null)?.places?.[0];
      if (raw?.location?.latitude === undefined || raw.location.longitude === undefined) return null;
      return {
        location: { lat: raw.location.latitude, lng: raw.location.longitude },
        label: raw.shortFormattedAddress ?? raw.displayName?.text ?? text,
      };
    },
  };
}
