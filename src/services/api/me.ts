import type { MeResponse, RelationshipSummary } from "@shared/api";
import type { RelationshipSetupInput } from "@shared/schemas";
import { apiFetch, apiPost } from "./client";

export const meApi = {
  get: () => apiFetch<MeResponse>("/me"),
  setupRelationship: (input: RelationshipSetupInput) =>
    apiPost<RelationshipSummary>("/relationship/setup", input),
};
