import type { Bindings } from "../../env";

// Envoltorio mínimo de Workers AI y Vectorize, para poder probar el resto sin Cloudflare.
//
// Modelos:
//   - Embeddings: @cf/baai/bge-m3 (multilingüe, entiende español; vectores de 1024 dimensiones).
//   - Respuesta: @cf/meta/llama-3.3-70b-instruct-fp8-fast, solo con los recuerdos encontrados.
// Ambos entran en el cupo gratis diario de Workers AI para el uso de dos personas.

export const EMBEDDING_MODEL = "@cf/baai/bge-m3";
export const ANSWER_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const EMBEDDING_DIMENSIONS = 1024;

export interface VectorMatch {
  id: string;
  score: number;
}

export interface MemoryAi {
  embed(texts: string[]): Promise<number[][]>;
  answer(system: string, user: string): Promise<string | null>;
  upsert(vectors: { id: string; values: number[]; relationshipId: string }[]): Promise<void>;
  remove(ids: string[]): Promise<void>;
  query(vector: number[], relationshipId: string, topK: number): Promise<VectorMatch[]>;
}

export function createMemoryAi(env: Bindings): MemoryAi | null {
  if (!env.AI || !env.MEMORY_INDEX) return null;
  const { AI, MEMORY_INDEX } = env;
  return {
    async embed(texts) {
      const result = (await AI.run(EMBEDDING_MODEL, { text: texts, truncate_inputs: true })) as { data?: number[][] };
      if (!Array.isArray(result.data) || result.data.length !== texts.length) throw new Error("Respuesta de embeddings inesperada");
      return result.data;
    },

    async answer(system, user) {
      const result = (await AI.run(ANSWER_MODEL, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 160,
        temperature: 0.2,
      })) as { response?: string | null };
      const text = result.response?.trim();
      return text ? text : null;
    },

    async upsert(vectors) {
      if (vectors.length === 0) return;
      await MEMORY_INDEX.upsert(vectors.map(({ id, values, relationshipId }) => ({ id, values, metadata: { relationshipId } })));
    },

    async remove(ids) {
      if (ids.length > 0) await MEMORY_INDEX.deleteByIds(ids);
    },

    async query(vector, relationshipId, topK) {
      // El filtro por relación es la barrera: nunca se devuelven recuerdos de otra pareja.
      const result = await MEMORY_INDEX.query(vector, { topK, filter: { relationshipId }, returnMetadata: "none" });
      return result.matches.map((match) => ({ id: match.id, score: match.score }));
    },
  };
}
