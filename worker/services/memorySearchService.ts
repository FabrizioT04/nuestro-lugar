import type { MemorySearchResponse, MemorySummary } from "@shared/api";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createMemoryRepository } from "../repositories/memoryRepository";
import { createMemorySearchRepository, type KeywordMatch } from "../repositories/memorySearchRepository";
import { createMemoryAi, type MemoryAi, type VectorMatch } from "./memoryAi/ai";
import { memoryText, parseQuestion, spanishDate, type MemoryOrder } from "./memoryAi/question";

// Búsqueda semántica de recuerdos (spec §14):
//   recuerdos → embeddings (Workers AI) → Vectorize
//   pregunta → embedding → búsqueda por similitud → recuerdos de D1 → respuesta corta
//
// El índice se pone al día solo, justo antes de cada búsqueda: los recuerdos nuevos, editados o
// borrados se detectan con memories.search_indexed_at (no hace falta tocar cada ruta que escribe).
// Si la IA falla o se acabó el cupo gratis del día, se busca por palabras y la app sigue funcionando.

const INDEX_BATCH = 25;
const INDEX_MAX_PER_SEARCH = 100;
const TOP_K = 15;
const MAX_RESULTS = 8;
/** Similitud mínima (coseno) y distancia máxima al mejor resultado para considerarlo relevante. */
const MIN_SCORE = 0.4;
const SCORE_WINDOW = 0.12;
const ANSWER_CONTEXT = 5;

export interface MemorySearchDeps {
  ai?: MemoryAi | null;
}

const log = (message: string, err: unknown) =>
  console.warn(JSON.stringify({ level: "warn", message, error: err instanceof Error ? err.message : String(err) }));

/** Indexa lo pendiente (hasta un tope por búsqueda) y quita del índice lo borrado. Devuelve cuántos quedan. */
export async function syncMemoryIndex(env: Bindings, ai: MemoryAi, relationshipId: string): Promise<number> {
  const repo = createMemorySearchRepository(env.DB);

  const removed = await repo.deletedStillIndexed(relationshipId, INDEX_MAX_PER_SEARCH);
  if (removed.length > 0) {
    await ai.remove(removed);
    await repo.markRemoved(relationshipId, removed);
  }

  let indexed = 0;
  while (indexed < INDEX_MAX_PER_SEARCH) {
    const batch = await repo.pending(relationshipId, INDEX_BATCH);
    if (batch.length === 0) break;
    const vectors = await ai.embed(batch.map((row) => memoryText({ ...row, tags: JSON.parse(row.tags_json) as string[] })));
    await ai.upsert(batch.map((row, index) => ({ id: row.id, values: vectors[index]!, relationshipId })));
    await repo.markIndexed(relationshipId, batch.map((row) => ({ id: row.id, updatedAt: row.updated_at })));
    indexed += batch.length;
    if (batch.length < INDEX_BATCH) break;
  }
  return repo.countPending(relationshipId);
}

/**
 * Junta los resultados por significado y por palabras. Por significado solo cuenta lo que está cerca
 * del mejor resultado (la escala de similitud cambia según la pregunta); las palabras suman.
 * Función pura para poder probarla.
 */
export function rankMatches(semantic: VectorMatch[], keywords: KeywordMatch[]): string[] {
  const best = semantic[0]?.score ?? 0;
  const threshold = Math.max(MIN_SCORE, best - SCORE_WINDOW);
  const scores = new Map<string, number>();
  for (const match of semantic) if (match.score >= threshold) scores.set(match.id, match.score);
  for (const match of keywords) scores.set(match.id, (scores.get(match.id) ?? MIN_SCORE - 0.05) + 0.05 * match.hits);
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** "La primera vez fue…": se responde con los datos, sin IA (no puede equivocarse con la fecha). */
export function orderedAnswer(order: Exclude<MemoryOrder, null>, items: MemorySummary[]): string | null {
  const memory = items[0];
  if (!memory) return null;
  const where = memory.placeName ? ` en ${memory.placeName}` : "";
  return `${order === "first" ? "La primera vez" : "La última vez"} fue el ${spanishDate(memory.happenedOn)}${where}: «${memory.title}».`;
}

const SYSTEM_PROMPT = [
  "Eres la memoria de un álbum privado de una pareja. Responde en español, en una o dos frases cálidas y breves,",
  "hablándoles de \"ustedes\". Usa SOLO los recuerdos que se te dan: no inventes fechas, lugares ni detalles.",
  "Si los recuerdos no responden la pregunta, dilo con amabilidad. Nada de listas ni de saludos.",
].join(" ");

export async function searchMemories(
  env: Bindings,
  user: AuthenticatedUser,
  question: string,
  deps: MemorySearchDeps = {},
): Promise<MemorySearchResponse> {
  const relationshipId = user.relationshipId!;
  const searchRepo = createMemorySearchRepository(env.DB);
  const ai = deps.ai === undefined ? createMemoryAi(env) : deps.ai;
  const parsed = parseQuestion(question);

  let pendingIndex = 0;
  let semantic: VectorMatch[] | null = null;
  if (ai) {
    try {
      pendingIndex = await syncMemoryIndex(env, ai, relationshipId);
      const [vector] = await ai.embed([question]);
      semantic = await ai.query(vector!, relationshipId, TOP_K);
    } catch (err) {
      log("Búsqueda con IA no disponible; se usa la búsqueda por palabras", err);
      semantic = null;
    }
  }
  if (semantic === null) pendingIndex = await searchRepo.countPending(relationshipId);

  const keywords = await searchRepo.keywordSearch(relationshipId, parsed.terms, 20);
  const ids = rankMatches(semantic ?? [], keywords);

  // Los resúmenes salen de D1, siempre filtrados por la relación y sin borrados.
  let items = await createMemoryRepository(env.DB).findSummaries(user.id, relationshipId, ids);
  if (parsed.year !== null) items = items.filter((item) => item.happenedOn.startsWith(String(parsed.year)));
  if (parsed.order) {
    items = [...items].sort((a, b) => (parsed.order === "first" ? 1 : -1) * a.happenedOn.localeCompare(b.happenedOn));
  }
  items = items.slice(0, MAX_RESULTS);

  const mode = semantic === null ? "keywords" : "ai";
  if (items.length === 0) return { answer: "No encontramos recuerdos sobre eso.", items, mode, pendingIndex };
  if (parsed.order) return { answer: orderedAnswer(parsed.order, items), items, mode, pendingIndex };

  let answer: string | null = null;
  if (ai && mode === "ai") {
    try {
      const context = await searchRepo.context(relationshipId, items.slice(0, ANSWER_CONTEXT).map((item) => item.id));
      const list = context
        .map((memory, index) =>
          [`${index + 1}. «${memory.title}»`, spanishDate(memory.happened_on), memory.place_name ? `Lugar: ${memory.place_name}` : null, memory.description]
            .filter(Boolean)
            .join(" — "),
        )
        .join("\n");
      answer = await ai.answer(SYSTEM_PROMPT, `Pregunta: ${question}\n\nRecuerdos:\n${list}`);
    } catch (err) {
      log("No se pudo generar la respuesta corta", err);
    }
  }
  return { answer, items, mode, pendingIndex };
}
