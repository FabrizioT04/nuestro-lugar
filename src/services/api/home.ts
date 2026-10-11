import type { HomeResponse } from "@shared/api";
import { apiFetch } from "./client";

export const homeApi = {
  get: () => apiFetch<HomeResponse>("/home"),
};
