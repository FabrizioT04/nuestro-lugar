import type { PlantResponse } from "@shared/api";
import { apiFetch, apiPost } from "./client";

export const plantApi = {
  get: () => apiFetch<PlantResponse>("/plant"),
  water: () => apiPost<PlantResponse>("/plant/water", {}),
  rename: (name: string) =>
    apiFetch<PlantResponse>("/plant/name", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }),
};
