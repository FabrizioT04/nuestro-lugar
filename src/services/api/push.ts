import type { PushConfigResponse, PushPreferences } from "@shared/api";
import { apiFetch, apiPost } from "./client";

export const pushApi = {
  config: () => apiFetch<PushConfigResponse>("/push"),
  subscribe: (subscription: PushSubscriptionJSON) => apiPost<null>("/push/subscriptions", subscription),
  unsubscribe: (endpoint: string) => apiPost<null>("/push/subscriptions/remove", { endpoint }),
  setPreferences: (preferences: PushPreferences) =>
    apiFetch<PushPreferences>("/push/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(preferences),
    }),
  test: (endpoint: string) => apiPost<{ delivered: boolean }>("/push/test", { endpoint }),
};
