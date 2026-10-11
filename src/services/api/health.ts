import type { DatabaseHealthResponse, HealthResponse } from "@shared/api";
import { apiFetch } from "./client";

export const healthApi = {
  get: () => apiFetch<HealthResponse>("/health"),
  database: () => apiFetch<DatabaseHealthResponse>("/health/db"),
};
