import type { Song, SongListResponse } from "@shared/api";
import type { SongCreatePayload } from "@shared/schemas";
import { apiFetch, apiPost } from "./client";

export const songsApi = {
  list: () => apiFetch<SongListResponse>("/songs"),
  create: (input: SongCreatePayload) => apiPost<Song>("/songs", input),
  markListened: (id: string) => apiFetch<Song>(`/songs/${id}/listened`, { method: "POST" }),
  love: (id: string, loved: boolean) =>
    apiFetch<Song>(`/songs/${id}/love`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loved }),
    }),
  remove: (id: string) => apiFetch<null>(`/songs/${id}`, { method: "DELETE" }),
};
