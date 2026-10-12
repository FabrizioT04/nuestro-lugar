import type { LetterDetail, LetterListResponse } from "@shared/api";
import type { LetterInput } from "@shared/schemas";
import { apiFetch, apiPost } from "./client";

export type LetterBox = "received" | "sent";

export const lettersApi = {
  list: (box: LetterBox) => apiFetch<LetterListResponse>(`/letters?box=${box}`),
  get: (id: string) => apiFetch<LetterDetail>(`/letters/${id}`),
  create: (input: LetterInput & { id?: string }, clientActionId?: string) => apiPost<LetterDetail>("/letters", input, clientActionId),
  update: (id: string, input: LetterInput) =>
    apiFetch<LetterDetail>(`/letters/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  /** Abre la carta (solo quien la recibe) y devuelve su contenido. */
  open: (id: string) => apiPost<LetterDetail>(`/letters/${id}/open`, {}),
  remove: (id: string) => apiFetch<null>(`/letters/${id}`, { method: "DELETE" }),
};
