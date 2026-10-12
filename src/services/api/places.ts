import type {
  GeoPoint,
  GeocodeResponse,
  PlacePreferences,
  PlacePreferencesResponse,
  PlaceRecommendationsResponse,
  PlaceStatus,
  SavedPlacesResponse,
} from "@shared/api";
import type { PlaceCategory, PlaceInteractionType } from "@shared/places";
import type { PlaceSearchInput } from "@shared/schemas";
import { apiFetch, apiPost } from "./client";

const put = (body: unknown): RequestInit => ({
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

// Todo pasa por el Worker: la clave de Google nunca llega al navegador.
export const placesApi = {
  recommend: (input: PlaceSearchInput) => apiPost<PlaceRecommendationsResponse>("/places/recommendations", input),
  saved: (origin: GeoPoint | null) =>
    apiFetch<SavedPlacesResponse>(`/places/saved${origin ? `?lat=${origin.lat.toFixed(4)}&lng=${origin.lng.toFixed(4)}` : ""}`),
  geocode: (q: string) => apiFetch<GeocodeResponse>(`/places/geocode?q=${encodeURIComponent(q)}`),
  preferences: () => apiFetch<PlacePreferencesResponse>("/places/preferences"),
  savePreferences: (input: PlacePreferences) => apiFetch<PlacePreferencesResponse>("/places/preferences", put(input)),
  setInteraction: (placeId: string, type: PlaceInteractionType, active: boolean, category: PlaceCategory | null) =>
    apiFetch<PlaceStatus>(`/places/${encodeURIComponent(placeId)}/interactions`, put({ type, active, category })),
};
