import type { PlanDetail, PlanListResponse, PlanStatusName } from "@shared/api";
import type { PlanInput } from "@shared/schemas";
import { actionHeader, apiFetch, apiPost } from "./client";

const json = (method: string, body: unknown, clientActionId?: string): RequestInit => ({
  method,
  headers: { "content-type": "application/json", ...actionHeader(clientActionId) },
  body: JSON.stringify(body),
});

/** Lo que envía el formulario: el presupuesto va en la unidad de la moneda (el Worker lo pasa a céntimos). */
export type PlanPayload = Omit<PlanInput, "budgetCents"> & { budget: number | null };

export const plansApi = {
  list: () => apiFetch<PlanListResponse>("/plans"),
  get: (id: string) => apiFetch<PlanDetail>(`/plans/${id}`),
  create: (input: PlanPayload & { id?: string }, clientActionId?: string) => apiPost<PlanDetail>("/plans", input, clientActionId),
  update: (id: string, input: PlanPayload) => apiFetch<PlanDetail>(`/plans/${id}`, json("PUT", input)),
  setStatus: (id: string, status: PlanStatusName, clientActionId?: string) =>
    apiFetch<PlanDetail>(`/plans/${id}/status`, json("PUT", { status }, clientActionId)),
  /** Crea (o devuelve) el recuerdo de un plan realizado. */
  toMemory: (id: string) => apiPost<{ memoryId: string }>(`/plans/${id}/memory`, {}),
  remove: (id: string) => apiFetch<null>(`/plans/${id}`, { method: "DELETE" }),
};
