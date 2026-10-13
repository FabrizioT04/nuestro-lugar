import { likePattern } from "./memoryRepository";

// Lo que necesita la búsqueda de recuerdos con IA: qué falta indexar y la búsqueda por palabras
// (que también sirve de respaldo cuando la IA no está disponible).

export interface IndexableMemory {
  id: string;
  title: string;
  description: string | null;
  happened_on: string;
  category: string | null;
  place_name: string | null;
  tags_json: string;
  updated_at: string;
}

export interface KeywordMatch {
  id: string;
  happened_on: string;
  /** Cuántas de las palabras buscadas aparecen. */
  hits: number;
}

const PENDING = "m.deleted_at IS NULL AND (m.search_indexed_at IS NULL OR m.search_indexed_at <> m.updated_at)";

export function createMemorySearchRepository(db: D1Database) {
  return {
    /** Recuerdos nuevos o editados desde la última vez que se indexaron. */
    async pending(relationshipId: string, limit: number): Promise<IndexableMemory[]> {
      const { results } = await db
        .prepare(
          `SELECT m.id, m.title, m.description, m.happened_on, m.category, m.place_name, m.updated_at,
             (SELECT json_group_array(t.name) FROM memory_tags mt JOIN tags t ON t.id = mt.tag_id WHERE mt.memory_id = m.id) AS tags_json
           FROM memories m WHERE m.relationship_id = ?1 AND ${PENDING}
           ORDER BY m.updated_at LIMIT ?2`,
        )
        .bind(relationshipId, limit)
        .all<IndexableMemory>();
      return results;
    },

    async countPending(relationshipId: string): Promise<number> {
      const row = await db
        .prepare(`SELECT COUNT(*) AS total FROM memories m WHERE m.relationship_id = ?1 AND ${PENDING}`)
        .bind(relationshipId)
        .first<{ total: number }>();
      return row?.total ?? 0;
    },

    /** Guarda qué versión (updated_at) quedó indexada. Si se editó mientras tanto, seguirá pendiente. */
    async markIndexed(relationshipId: string, items: { id: string; updatedAt: string }[]): Promise<void> {
      if (items.length === 0) return;
      await db.batch(
        items.map(({ id, updatedAt }) =>
          db.prepare("UPDATE memories SET search_indexed_at = ?1 WHERE id = ?2 AND relationship_id = ?3").bind(updatedAt, id, relationshipId),
        ),
      );
    },

    /** Recuerdos borrados que todavía están en el índice. */
    async deletedStillIndexed(relationshipId: string, limit: number): Promise<string[]> {
      const { results } = await db
        .prepare("SELECT id FROM memories WHERE relationship_id = ?1 AND deleted_at IS NOT NULL AND search_indexed_at IS NOT NULL LIMIT ?2")
        .bind(relationshipId, limit)
        .all<{ id: string }>();
      return results.map((row) => row.id);
    },

    async markRemoved(relationshipId: string, ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      await db.batch(
        ids.map((id) => db.prepare("UPDATE memories SET search_indexed_at = NULL WHERE id = ?1 AND relationship_id = ?2").bind(id, relationshipId)),
      );
    },

    /** Lo que se le pasa a la IA para responder (solo de los recuerdos encontrados). */
    async context(relationshipId: string, ids: string[]): Promise<{ id: string; title: string; happened_on: string; place_name: string | null; description: string | null }[]> {
      if (ids.length === 0) return [];
      const placeholders = ids.map((_, index) => `?${index + 2}`).join(", ");
      const { results } = await db
        .prepare(
          `SELECT id, title, happened_on, place_name, substr(description, 1, 400) AS description FROM memories
           WHERE relationship_id = ?1 AND deleted_at IS NULL AND id IN (${placeholders})`,
        )
        .bind(relationshipId, ...ids)
        .all<{ id: string; title: string; happened_on: string; place_name: string | null; description: string | null }>();
      const byId = new Map(results.map((row) => [row.id, row]));
      return ids.map((id) => byId.get(id)).filter((row) => row !== undefined);
    },

    /** Recuerdos que contienen alguna de las palabras (título, descripción, lugar, categoría o etiquetas). */
    async keywordSearch(relationshipId: string, terms: string[], limit: number): Promise<KeywordMatch[]> {
      if (terms.length === 0) return [];
      const params: unknown[] = [relationshipId];
      const hitExpressions = terms.map((term) => {
        params.push(likePattern(term));
        const p = `?${params.length}`;
        return `(CASE WHEN m.title LIKE ${p} ESCAPE '\\' OR m.description LIKE ${p} ESCAPE '\\' OR m.place_name LIKE ${p} ESCAPE '\\'
          OR m.category LIKE ${p} ESCAPE '\\'
          OR EXISTS (SELECT 1 FROM memory_tags mt JOIN tags t ON t.id = mt.tag_id WHERE mt.memory_id = m.id AND t.name LIKE ${p} ESCAPE '\\')
          THEN 1 ELSE 0 END)`;
      });
      params.push(limit);
      const { results } = await db
        .prepare(
          `SELECT id, happened_on, hits FROM (
             SELECT m.id, m.happened_on, ${hitExpressions.join(" + ")} AS hits
             FROM memories m WHERE m.relationship_id = ?1 AND m.deleted_at IS NULL
           ) WHERE hits > 0 ORDER BY hits DESC, happened_on DESC LIMIT ?${params.length}`,
        )
        .bind(...params)
        .all<KeywordMatch>();
      return results;
    },
  };
}
