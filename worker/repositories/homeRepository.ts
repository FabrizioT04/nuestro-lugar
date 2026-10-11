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
          `SELECT id, title, happened_on, place_name FROM memories
           WHERE relationship_id = ?1 AND deleted_at IS NULL
           ORDER BY is_highlighted DESC, happened_on DESC
           LIMIT 1`,
        )
        .bind(relationshipId)
        .first<{ id: string; title: string; happened_on: string; place_name: string | null }>();
      return row ? { id: row.id, title: row.title, happenedOn: row.happened_on, placeName: row.place_name } : null;
    },
  };
}
