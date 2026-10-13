import type { LetterDetail, LetterListResponse, LetterSummary } from "@shared/api";
import { zonedTimeToUtc } from "@shared/dates";
import type { LetterInput } from "@shared/schemas";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createLetterRepository, type LetterRow, type LetterRowWithBody, type LetterWrite } from "../repositories/letterRepository";
import { createRelationshipRepository } from "../repositories/relationshipRepository";
import { badRequest, conflict, forbidden, misconfigured, notFound } from "../utils/errors";

// Reglas de las cartas (todas se deciden aquí, nunca en React):
// - El destinatario siempre es la otra persona de la relación; el cliente no lo elige.
// - Antes de unlock_at el contenido no sale del Worker para el destinatario.
// - Las sorpresas no existen para el destinatario hasta su fecha (404).
// - El destinatario lee el contenido solo después de abrirla (POST /:id/open), que registra opened_at.
// - El autor siempre puede leer lo que escribió; puede editarla mientras no se haya abierto.

/** Una carta no puede programarse a más de este tiempo. */
const MAX_YEARS_AHEAD = 50;

const relationshipOf = (user: AuthenticatedUser) => user.relationshipId!;
const nowIso = () => new Date().toISOString();

export const isLocked = (row: Pick<LetterRow, "unlock_at">, now: string) => row.unlock_at !== null && row.unlock_at > now;

/** Las sorpresas pendientes son invisibles para el destinatario. */
export const isHiddenFrom = (row: LetterRow, viewerId: string, now: string) =>
  row.recipient_id === viewerId && row.letter_type === "surprise" && isLocked(row, now);

export function toSummary(row: LetterRow, viewerId: string, now: string): LetterSummary {
  return {
    id: row.id,
    type: row.letter_type,
    title: row.title,
    openWhenLabel: row.open_when_label,
    unlockAt: row.unlock_at,
    isLocked: isLocked(row, now),
    openedAt: row.opened_at,
    isMine: row.author_id === viewerId,
    author: { id: row.author_id, displayName: row.author_name },
    recipient: { id: row.recipient_id, displayName: row.recipient_name },
    createdAt: row.created_at,
  };
}

export function toDetail(row: LetterRowWithBody, viewerId: string, now: string): LetterDetail {
  const summary = toSummary(row, viewerId, now);
  const canRead = summary.isMine || (summary.openedAt !== null && !summary.isLocked);
  return {
    ...summary,
    body: canRead ? row.body : null,
    canEdit: summary.isMine && summary.openedAt === null,
    updatedAt: row.updated_at,
  };
}

async function loadVisible(env: Bindings, user: AuthenticatedUser, letterId: string, now: string) {
  const row = await createLetterRepository(env.DB).findWithBody(relationshipOf(user), letterId);
  if (!row || isHiddenFrom(row, user.id, now)) throw notFound("Carta no encontrada");
  return row;
}

/** Convierte fecha y hora locales de la pareja en el instante UTC de apertura. */
async function resolveWrite(env: Bindings, user: AuthenticatedUser, input: LetterInput, now: string, currentUnlockAt?: string | null): Promise<LetterWrite> {
  let unlockAt: string | null = null;
  if (input.unlockOn) {
    const relationship = await createRelationshipRepository(env.DB).findSummary(relationshipOf(user));
    if (!relationship) throw notFound("Relación no encontrada");
    unlockAt = zonedTimeToUtc(input.unlockOn, input.unlockTime, relationship.timezone).toISOString();

    // Al editar sin tocar la fecha se acepta aunque ya haya pasado.
    if (unlockAt !== currentUnlockAt) {
      if (unlockAt <= now) throw badRequest("La fecha de apertura tiene que ser en el futuro");
      const limit = new Date(now);
      limit.setUTCFullYear(limit.getUTCFullYear() + MAX_YEARS_AHEAD);
      if (unlockAt > limit.toISOString()) throw badRequest(`Como mucho ${MAX_YEARS_AHEAD} años en el futuro`);
    }
  }
  return { type: input.type, title: input.title, body: input.body, openWhenLabel: input.openWhenLabel, unlockAt };
}

export async function listLetters(env: Bindings, user: AuthenticatedUser, box: "received" | "sent"): Promise<LetterListResponse> {
  const now = nowIso();
  const rows = await createLetterRepository(env.DB).list(relationshipOf(user), user.id, box, now);
  return { items: rows.map((row) => toSummary(row, user.id, now)) };
}

export async function getLetter(env: Bindings, user: AuthenticatedUser, letterId: string): Promise<LetterDetail> {
  const now = nowIso();
  return toDetail(await loadVisible(env, user, letterId, now), user.id, now);
}

export async function listPendingLetters(env: Bindings, user: AuthenticatedUser, limit: number): Promise<LetterSummary[]> {
  const now = nowIso();
  const rows = await createLetterRepository(env.DB).listPending(relationshipOf(user), user.id, now, limit);
  return rows.map((row) => toSummary(row, user.id, now));
}

export async function createLetter(env: Bindings, user: AuthenticatedUser, input: LetterInput & { id?: string }): Promise<LetterDetail> {
  const now = nowIso();
  const recipientId = await createRelationshipRepository(env.DB).findPartnerId(relationshipOf(user), user.id);
  if (!recipientId) throw misconfigured();

  const letter = await resolveWrite(env, user, input, now);
  const letterId = input.id ?? crypto.randomUUID();
  try {
    await createLetterRepository(env.DB).create(letterId, relationshipOf(user), user.id, recipientId, letter);
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed: letters.id")) {
      throw conflict("Esta carta ya existe");
    }
    throw err;
  }
  return getLetter(env, user, letterId);
}

export async function updateLetter(env: Bindings, user: AuthenticatedUser, letterId: string, input: LetterInput): Promise<LetterDetail> {
  const now = nowIso();
  const current = await loadVisible(env, user, letterId, now);
  if (current.author_id !== user.id) throw forbidden("Solo quien escribió la carta puede editarla");
  if (current.opened_at) throw conflict("Ya la abrió; esta carta no se puede editar");

  const letter = await resolveWrite(env, user, input, now, current.unlock_at);
  const updated = await createLetterRepository(env.DB).update(relationshipOf(user), letterId, user.id, letter);
  // Se abrió justo entre la lectura y la escritura.
  if (!updated) throw conflict("Ya la abrió; esta carta no se puede editar");
  return getLetter(env, user, letterId);
}

export async function openLetter(env: Bindings, user: AuthenticatedUser, letterId: string): Promise<LetterDetail> {
  const now = nowIso();
  const current = await loadVisible(env, user, letterId, now);
  if (current.recipient_id !== user.id) throw forbidden("Esta carta es para la otra persona");
  if (isLocked(current, now)) throw forbidden("Todavía no se puede abrir");
  await createLetterRepository(env.DB).markOpened(relationshipOf(user), letterId, user.id, now);
  return getLetter(env, user, letterId);
}

export async function deleteLetter(env: Bindings, user: AuthenticatedUser, letterId: string): Promise<void> {
  const now = nowIso();
  const current = await loadVisible(env, user, letterId, now);
  if (current.author_id !== user.id) throw forbidden("Solo quien escribió la carta puede borrarla");
  await createLetterRepository(env.DB).softDelete(relationshipOf(user), letterId, user.id);
}

export function countUnopenedLetters(env: Bindings, user: AuthenticatedUser): Promise<number> {
  return createLetterRepository(env.DB).countUnopened(relationshipOf(user), user.id, nowIso());
}
