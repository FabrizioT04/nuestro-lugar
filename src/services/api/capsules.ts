import type { CapsuleDetail, CapsuleListResponse } from "@shared/api";
import type { CapsulePayload } from "@shared/schemas";
import { apiFetch, apiPost, mediaSrc } from "./client";

export const capsulesApi = {
  list: () => apiFetch<CapsuleListResponse>("/capsules"),
  get: (id: string) => apiFetch<CapsuleDetail>(`/capsules/${id}`),
  create: (input: CapsulePayload & { id?: string }) => apiPost<CapsuleDetail>("/capsules", input),
  update: (id: string, input: CapsulePayload) =>
    apiFetch<CapsuleDetail>(`/capsules/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  /** Abre la cápsula (solo quien no la guardó, llegada su fecha) y devuelve su contenido. */
  open: (id: string) => apiPost<CapsuleDetail>(`/capsules/${id}/open`, {}),
  remove: (id: string) => apiFetch<null>(`/capsules/${id}`, { method: "DELETE" }),
};

/** URL de una foto o audio de una cápsula: el Worker comprueba la fecha en cada petición. */
export function capsuleMediaUrl(capsuleId: string, mediaId: string, size: "full" | "thumb" = "full"): string {
  return mediaSrc(`/capsules/${capsuleId}/media/${mediaId}${size === "thumb" ? "?size=thumb" : ""}`);
}
