import type { CapsuleContents, CapsuleDetail, CapsuleListResponse, CapsuleSummary } from "@shared/api";
import { zonedTimeToUtc } from "@shared/dates";
import type { CapsuleInput } from "@shared/schemas";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import {
  createCapsuleRepository,
  type CapsuleMediaRow,
  type CapsuleRow,
  type CapsuleRowWithContents,
  type CapsuleWrite,
} from "../repositories/capsuleRepository";
import { createRelationshipRepository } from "../repositories/relationshipRepository";
import { badRequest, conflict, forbidden, misconfigured, notFound } from "../utils/errors";
import { serveR2Object } from "./mediaService";

// Reglas de la caja del futuro (todas se deciden aquí, nunca en React):
// - Antes de unlock_at ni el texto, ni la carta, ni las fotos, ni el audio salen del Worker
//   para la otra persona: la lista y el detalle solo llevan título y fecha, y los archivos
//   se sirven por GET /:id/media/:mediaId, que vuelve a comprobar la fecha.
// - Llegada la fecha, la otra persona la abre (POST /:id/open, registra opened_at) y ve su contenido.
// - Quien la guardó siempre ve lo que guardó y puede editarla mientras siga cerrada.
// - Los archivos solo se pueden meter en una cápsula si los subió esa misma persona como
//   "capsule" y no están ya en otra (nadie puede colarse a ver los de otra cápsula).

/** Una cápsula no puede programarse a más de este tiempo. */
const MAX_YEARS_AHEAD = 50;

const relationshipOf = (user: AuthenticatedUser) => user.relationshipId!;
const nowIso = () => new Date().toISOString();

export const isLocked = (row: Pick<CapsuleRow, "unlock_at">, now: string) => row.unlock_at > now;

/** ¿Puede ver el contenido? Quien la guardó, siempre; la otra persona, después de su fecha y de abrirla. */
export const canRead = (row: CapsuleRow, viewerId: string, now: string) =>
  row.created_by === viewerId || (!isLocked(row, now) && row.opened_at !== null);

export function toSummary(row: CapsuleRow, viewerId: string, now: string): CapsuleSummary {
  return {
    id: row.id,
    title: row.title,
    recipient: row.recipient_id === null ? "both" : "partner",
    unlockAt: row.unlock_at,
    isLocked: isLocked(row, now),
    openedAt: row.opened_at,
    isMine: row.created_by === viewerId,
    author: { id: row.created_by, displayName: row.author_name },
    createdAt: row.created_at,
  };
}

export function toDetail(row: CapsuleRowWithContents, media: CapsuleMediaRow[], viewerId: string, now: string): CapsuleDetail {
  const summary = toSummary(row, viewerId, now);
  let contents: CapsuleContents | null = null;
  if (canRead(row, viewerId, now)) {
    const audio = media.find((m) => m.kind === "audio");
    contents = {
      message: row.message,
      letter: row.letter,
      photos: media.filter((m) => m.kind === "photo").map(({ id, width, height }) => ({ id, width, height })),
      audio: audio ? { id: audio.id, durationMs: audio.duration_ms } : null,
    };
  }
  return { ...summary, contents, canEdit: summary.isMine && summary.isLocked, updatedAt: row.updated_at };
}

async function load(env: Bindings, user: AuthenticatedUser, capsuleId: string) {
  const row = await createCapsuleRepository(env.DB).findWithContents(relationshipOf(user), capsuleId);
  if (!row) throw notFound("Cápsula no encontrada");
  return row;
}

/** Comprueba los archivos y convierte la fecha y hora locales de la pareja en el instante UTC de apertura. */
async function resolveWrite(env: Bindings, user: AuthenticatedUser, input: CapsuleInput, now: string, capsuleId: string | null): Promise<CapsuleWrite> {
  const relationshipRepo = createRelationshipRepository(env.DB);
  const relationship = await relationshipRepo.findSummary(relationshipOf(user));
  if (!relationship) throw notFound("Relación no encontrada");

  const unlockAt = zonedTimeToUtc(input.unlockOn, input.unlockTime, relationship.timezone).toISOString();
  if (unlockAt <= now) throw badRequest("La fecha de apertura tiene que ser en el futuro");
  const limit = new Date(now);
  limit.setUTCFullYear(limit.getUTCFullYear() + MAX_YEARS_AHEAD);
  if (unlockAt > limit.toISOString()) throw badRequest(`Como mucho ${MAX_YEARS_AHEAD} años en el futuro`);

  const repo = createCapsuleRepository(env.DB);
  const [photos, audios] = await Promise.all([
    repo.countLinkable(input.photoIds, relationshipOf(user), user.id, "photo", capsuleId),
    repo.countLinkable(input.audioId ? [input.audioId] : [], relationshipOf(user), user.id, "audio", capsuleId),
  ]);
  if (photos !== input.photoIds.length) throw badRequest("Alguna foto no existe o no se puede usar en esta cápsula");
  if (input.audioId && audios !== 1) throw badRequest("El audio no existe o no se puede usar en esta cápsula");

  let recipientId: string | null = null;
  if (input.recipient === "partner") {
    recipientId = await relationshipRepo.findPartnerId(relationshipOf(user), user.id);
    if (!recipientId) throw misconfigured();
  }

  return {
    recipientId,
    title: input.title,
    message: input.message,
    letter: input.letter,
    unlockAt,
    photoIds: input.photoIds,
    audioId: input.audioId,
  };
}

export async function listCapsules(env: Bindings, user: AuthenticatedUser): Promise<CapsuleListResponse> {
  const now = nowIso();
  const rows = await createCapsuleRepository(env.DB).list(relationshipOf(user));
  return { items: rows.map((row) => toSummary(row, user.id, now)) };
}

export async function listPendingCapsules(env: Bindings, user: AuthenticatedUser, limit: number): Promise<CapsuleSummary[]> {
  const now = nowIso();
  const rows = await createCapsuleRepository(env.DB).listPending(relationshipOf(user), user.id, limit);
  return rows.map((row) => toSummary(row, user.id, now));
}

export async function getCapsule(env: Bindings, user: AuthenticatedUser, capsuleId: string): Promise<CapsuleDetail> {
  const now = nowIso();
  const row = await load(env, user, capsuleId);
  // Los archivos solo se consultan si se van a devolver.
  const media = canRead(row, user.id, now) ? await createCapsuleRepository(env.DB).listMedia(capsuleId) : [];
  return toDetail(row, media, user.id, now);
}

export async function createCapsule(env: Bindings, user: AuthenticatedUser, input: CapsuleInput & { id?: string }): Promise<CapsuleDetail> {
  const now = nowIso();
  const capsule = await resolveWrite(env, user, input, now, null);
  const capsuleId = input.id ?? crypto.randomUUID();
  try {
    await createCapsuleRepository(env.DB).create(capsuleId, relationshipOf(user), user.id, capsule);
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed: future_capsules.id")) {
      throw conflict("Esta cápsula ya existe");
    }
    // Dos cápsulas guardándose a la vez con el mismo archivo.
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed: capsule_media.media_id")) {
      throw conflict("Algún archivo ya está en otra cápsula");
    }
    throw err;
  }
  return getCapsule(env, user, capsuleId);
}

export async function updateCapsule(env: Bindings, user: AuthenticatedUser, capsuleId: string, input: CapsuleInput): Promise<CapsuleDetail> {
  const now = nowIso();
  const current = await load(env, user, capsuleId);
  if (current.created_by !== user.id) throw forbidden("Solo quien guardó la cápsula puede editarla");
  if (!isLocked(current, now)) throw conflict("Ya llegó su fecha; esta cápsula no se puede editar");

  const capsule = await resolveWrite(env, user, input, now, capsuleId);
  const updated = await createCapsuleRepository(env.DB).update(relationshipOf(user), capsuleId, user.id, capsule, now);
  // Llegó su fecha justo entre la lectura y la escritura.
  if (!updated) throw conflict("Ya llegó su fecha; esta cápsula no se puede editar");
  return getCapsule(env, user, capsuleId);
}

export async function openCapsule(env: Bindings, user: AuthenticatedUser, capsuleId: string): Promise<CapsuleDetail> {
  const now = nowIso();
  const current = await load(env, user, capsuleId);
  if (current.created_by === user.id) throw forbidden("Esta cápsula la guardaste tú");
  if (isLocked(current, now)) throw forbidden("Todavía no se puede abrir");
  await createCapsuleRepository(env.DB).markOpened(relationshipOf(user), capsuleId, user.id, now);
  return getCapsule(env, user, capsuleId);
}

export async function deleteCapsule(env: Bindings, user: AuthenticatedUser, capsuleId: string): Promise<void> {
  const current = await load(env, user, capsuleId);
  if (current.created_by !== user.id) throw forbidden("Solo quien guardó la cápsula puede borrarla");
  await createCapsuleRepository(env.DB).softDelete(relationshipOf(user), capsuleId, user.id);
}

/** Foto o audio de una cápsula: misma comprobación de fecha que el contenido. */
export async function serveCapsuleMedia(
  env: Bindings,
  user: AuthenticatedUser,
  capsuleId: string,
  mediaId: string,
  size: "full" | "thumb",
  requestHeaders: Headers,
): Promise<Response> {
  const now = nowIso();
  const capsule = await load(env, user, capsuleId);
  if (!canRead(capsule, user.id, now)) {
    throw forbidden(isLocked(capsule, now) ? "Todavía no se puede abrir" : "Primero abre la cápsula");
  }

  const media = await createCapsuleRepository(env.DB).findMediaInCapsule(capsuleId, mediaId);
  if (!media) throw notFound("Archivo no encontrado");
  const key = size === "thumb" && media.thumb_r2_key ? media.thumb_r2_key : media.r2_key;
  // Sin "immutable": si en el futuro se cambia una regla, el navegador vuelve a preguntar.
  return serveR2Object(env, key, requestHeaders, "private, max-age=3600");
}
