import type { HighlightedMemory } from "@shared/api";

export interface ImportantDateRow {
  title: string;
  emoji: string | null;
  event_date: string;
  recurs_yearly: number;
}

export function createHomeRepository(db: D1Database) {
  return {
    async listImportantDates(relationshipId: string): Promise<ImportantDateRow[]> {
      const { results } = await db
        .prepare(
          `SELECT title, emoji, event_date, recurs_yearly FROM important_dates
           WHERE relationship_id = ?1 AND deleted_at IS NULL`,
        )
        .bind(relationshipId)
        .all<ImportantDateRow>();
      return results;
    },

    /** El recuerdo marcado como destacado más reciente; si no hay, el último recuerdo. */
    async findHighlightedMemory(relationshipId: string): Promise<HighlightedMemory | null> {
      const row = await db
        .prepare(
          `SELECT m.id, m.title, m.happened_on, m.place_name, c.id AS cover_id, c.width AS cover_width, c.height AS cover_height
           FROM memories m
           LEFT JOIN media_objects c ON c.id = (
             SELECT mp.media_id FROM memory_photos mp
             JOIN media_objects mo ON mo.id = mp.media_id AND mo.deleted_at IS NULL
             WHERE mp.memory_id = m.id ORDER BY mp.sort_order LIMIT 1
           )
           WHERE m.relationship_id = ?1 AND m.deleted_at IS NULL
           ORDER BY m.is_highlighted DESC, m.happened_on DESC, m.created_at DESC
           LIMIT 1`,
        )
        .bind(relationshipId)
        .first<{
          id: string;
          title: string;
          happened_on: string;
          place_name: string | null;
          cover_id: string | null;
          cover_width: number | null;
          cover_height: number | null;
        }>();
      if (!row) return null;
      return {
        id: row.id,
        title: row.title,
        happenedOn: row.happened_on,
        placeName: row.place_name,
        cover: row.cover_id ? { id: row.cover_id, width: row.cover_width, height: row.cover_height } : null,
      };
    },
  };
}
