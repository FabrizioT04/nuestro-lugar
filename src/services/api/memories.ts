import type { MemoryDetail, MemoryFilters, MemoryListResponse, MemorySearchResponse } from "@shared/api";
import type { MemoryInput } from "@shared/schemas";
import { actionHeader, apiFetch, apiPost } from "./client";

export interface MemoryListParams {
  q?: string;
  category?: string;
  tag?: string;
  favorites?: boolean;
  cursor?: string;
  limit?: number;
}

const json = (method: string, body: unknown, clientActionId?: string): RequestInit => ({
  method,
  headers: { "content-type": "application/json", ...actionHeader(clientActionId) },
  body: JSON.stringify(body),
});

export const memoriesApi = {
  /** Búsqueda con IA: "¿cuándo fuimos por primera vez a la playa?". */
  ask: (question: string) => apiPost<MemorySearchResponse>("/memories/search", { question }),
  list(params: MemoryListParams = {}) {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.category) search.set("category", params.category);
    if (params.tag) search.set("tag", params.tag);
    if (params.favorites) search.set("favorites", "1");
    if (params.cursor) search.set("cursor", params.cursor);
    if (params.limit) search.set("limit", String(params.limit));
    const query = search.toString();
    return apiFetch<MemoryListResponse>(`/memories${query ? `?${query}` : ""}`);
  },
  filters: () => apiFetch<MemoryFilters>("/memories/filters"),
  get: (id: string) => apiFetch<MemoryDetail>(`/memories/${id}`),
  create: (input: MemoryInput & { id?: string }, clientActionId?: string) => apiPost<MemoryDetail>("/memories", input, clientActionId),
  update: (id: string, input: MemoryInput) => apiFetch<MemoryDetail>(`/memories/${id}`, json("PUT", input)),
  remove: (id: string) => apiFetch<null>(`/memories/${id}`, { method: "DELETE" }),
  setFavorite: (id: string, favorite: boolean, clientActionId?: string) =>
    apiFetch<{ favorite: boolean }>(`/memories/${id}/favorite`, json("PUT", { favorite }, clientActionId)),
  setCover: (mediaId: string | null) =>
    apiFetch<{ coverMediaId: string | null }>("/relationship/cover", json("PUT", { mediaId })),
};
