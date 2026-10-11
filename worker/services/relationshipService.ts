import type { RelationshipSummary } from "@shared/api";
import type { RelationshipSetupInput } from "@shared/schemas";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { parseAllowedEmails, partnerEmailOf } from "../auth/allowedEmails";
import { createRelationshipRepository } from "../repositories/relationshipRepository";
import { conflict, misconfigured } from "../utils/errors";

/** Configuración inicial: la hace quien entre primero, una sola vez, para los dos. */
export async function setupRelationship(
  env: Bindings,
  user: AuthenticatedUser,
  input: RelationshipSetupInput,
): Promise<RelationshipSummary> {
  if (user.relationshipId) throw conflict("La relación ya está configurada");

  // La pareja se deduce del servidor (ALLOWED_EMAILS), nunca de un dato enviado por el cliente.
  const partnerEmail = partnerEmailOf(user.email, parseAllowedEmails(env.ALLOWED_EMAILS));
  if (!partnerEmail) {
    console.error(JSON.stringify({ level: "error", message: "ALLOWED_EMAILS debe tener exactamente 2 correos" }));
    throw misconfigured();
  }

  const repository = createRelationshipRepository(env.DB);
  const relationshipId = crypto.randomUUID();
  try {
    await repository.create({
      relationshipId,
      startedOn: input.startedOn,
      timezone: input.timezone,
      me: { id: user.id, displayName: input.myName },
      partner: { email: partnerEmail, displayName: input.partnerName },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      throw conflict("La relación ya fue configurada por tu pareja. Recarga la página.");
    }
    throw err;
  }

  const summary = await repository.findSummary(relationshipId);
  if (!summary) throw new Error("La relación recién creada no se encontró");
  return summary;
}
