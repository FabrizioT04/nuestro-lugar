import type { HomeResponse } from "@shared/api";
import type { SeenSection } from "@shared/schemas";
import { apiFetch, apiPost } from "./client";

export const homeApi = {
  get: () => apiFetch<HomeResponse>("/home"),
  /** Avisa que se entró a una sección para apagar su globito en el inicio. */
  markSeen: (section: SeenSection) => apiPost<null>("/home/seen", { section }),
};
