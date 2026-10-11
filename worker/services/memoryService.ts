import type { MemoryDetail, MemoryFilters, MemoryListResponse } from "@shared/api";
import type { MemoryInput } from "@shared/schemas";
import type { z } from "zod";
import type { memoryListQuerySchema } from "@shared/schemas";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createMediaRepository } from "../repositories/mediaRepository";
import { createMemoryRepository, type MemoryCursor } from "../repositories/memoryRepository";
import { badRequest, conflict, notFound } from "../utils/errors";

type ListQuery = z.infer<typeof memoryListQuerySchema>;

export function encodeCursor(cursor: MemoryCursor): string {
  return btoa(JSON.stringify([cursor.happenedOn, cursor.createdAt, cursor.id]))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeCursor(raw: string): MemoryCursor {
  try {
    const json = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
    const [happenedOn, createdAt, id] = JSON.parse(json) as unknown[];
    if (typeof happenedOn === "string" && typeof createdAt === "string" && typeof id === "string") {
      return { happenedOn, createdAt, id };
    }
  } catch {
    // cae al error de abajo
  }
  throw badRequest("Cursor inválido");
}

const relationshipOf = (user: AuthenticatedUser) => user.relationshipId!;

/** Las fotos deben existir, ser de esta relación y haberse subido para un recuerdo. */
async function assertPhotosOwned(env: Bindings, user: AuthenticatedUser, photoIds: string[]) {
  if (photoIds.length === 0) return;
  const owned = await createMediaRepository(env.DB).countOwned(photoIds, relationshipOf(user), ["memory"]);
  if (owned !== photoIds.length) throw badRequest("Alguna foto no existe o no es de este lugar");
}

export async function listMemories(env: Bindings, user: AuthenticatedUser, query: ListQuery): Promise<MemoryListResponse> {
  const result = await createMemoryRepository(env.DB).list(user.id, relationshipOf(user), {
    q: query.q || undefined,
    category: query.category || undefined,
    tag: query.tag || undefined,
    favoritesOnly: query.favorites === "1",
    after: query.cursor ? decodeCursor(query.cursor) : undefined,
    limit: query.limit,
  });
  return { items: result.items, nextCursor: result.hasMore && result.last ? encodeCursor(result.last) : null };
}

export async function getMemory(env: Bindings, user: AuthenticatedUser, memoryId: string): Promise<MemoryDetail> {
  const memory = await createMemoryRepository(env.DB).findDetail(user.id, relationshipOf(user), memoryId);
  if (!memory) throw notFound("Recuerdo no encontrado");
  return memory;
}

export async function createMemory(
  env: Bindings,
  user: AuthenticatedUser,
  input: MemoryInput & { id?: string },
): Promise<MemoryDetail> {
  await assertPhotosOwned(env, user, input.photoIds);
  const memoryId = input.id ?? crypto.randomUUID();
  try {
    await createMemoryRepository(env.DB).create(memoryId, relationshipOf(user), user.id, input);
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed: memories.id")) {
      throw conflict("Este recuerdo ya existe");
    }
    throw err;
  }
  return getMemory(env, user, memoryId);
}

export async function updateMemory(
  env: Bindings,
  user: AuthenticatedUser,
  memoryId: string,
  input: MemoryInput,
): Promise<MemoryDetail> {
  const repository = createMemoryRepository(env.DB);
  // Los dos pueden editar cualquier recuerdo de su relación, pero nada fuera de ella.
  if (!(await repository.exists(relationshipOf(user), memoryId))) throw notFound("Recuerdo no encontrado");
  await assertPhotosOwned(env, user, input.photoIds);
  await repository.update(memoryId, relationshipOf(user), input);
  return getMemory(env, user, memoryId);
}

export async function deleteMemory(env: Bindings, user: AuthenticatedUser, memoryId: string): Promise<void> {
  const repository = createMemoryRepository(env.DB);
  if (!(await repository.exists(relationshipOf(user), memoryId))) throw notFound("Recuerdo no encontrado");
  await repository.softDelete(relationshipOf(user), memoryId);
}

export async function setMemoryFavorite(env: Bindings, user: AuthenticatedUser, memoryId: string, favorite: boolean) {
  const repository = createMemoryRepository(env.DB);
  if (!(await repository.exists(relationshipOf(user), memoryId))) throw notFound("Recuerdo no encontrado");
  await repository.setFavorite(user.id, memoryId, favorite);
}

export function getMemoryFilters(env: Bindings, user: AuthenticatedUser): Promise<MemoryFilters> {
  return createMemoryRepository(env.DB).filters(relationshipOf(user));
}
