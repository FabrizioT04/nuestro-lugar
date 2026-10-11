import type { MeResponse } from "@shared/api";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { parseAllowedEmails, partnerEmailOf } from "../auth/allowedEmails";
import { createRelationshipRepository } from "../repositories/relationshipRepository";

export async function getMe(env: Bindings, user: AuthenticatedUser): Promise<MeResponse> {
  const relationship = user.relationshipId
    ? await createRelationshipRepository(env.DB).findSummary(user.relationshipId)
    : null;

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      introSeenAt: user.introSeenAt,
    },
    relationship,
    partnerEmail: partnerEmailOf(user.email, parseAllowedEmails(env.ALLOWED_EMAILS)),
  };
}
