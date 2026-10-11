import type { ImportantDate, TimelineResponse, UsResponse } from "@shared/api";
import type { ImportantDatePayload } from "@shared/schemas";
import { apiFetch, apiPost } from "./client";

export const usApi = {
  get: () => apiFetch<UsResponse>("/us"),
  timeline: () => apiFetch<TimelineResponse>("/us/timeline"),
};

export const importantDatesApi = {
  get: (id: string) => apiFetch<ImportantDate>(`/important-dates/${id}`),
  create: (input: ImportantDatePayload & { id?: string }) => apiPost<ImportantDate>("/important-dates", input),
  update: (id: string, input: ImportantDatePayload) =>
    apiFetch<ImportantDate>(`/important-dates/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  remove: (id: string) => apiFetch<null>(`/important-dates/${id}`, { method: "DELETE" }),
};
