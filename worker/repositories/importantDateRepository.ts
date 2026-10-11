import type { ImportantDateTypeName } from "@shared/api";
import type { ImportantDateInput } from "@shared/schemas";

export interface ImportantDateRow {
  id: string;
  title: string;
  date_type: ImportantDateTypeName;
  event_date: string;
  recurs_yearly: number;
  emoji: string | null;
  notes: string | null;
}

const COLUMNS = "id, title, date_type, event_date, recurs_yearly, emoji, notes";

export function createImportantDateRepository(db: D1Database) {
  return {
    async list(relationshipId: string): Promise<ImportantDateRow[]> {
      const { results } = await db
        .prepare(`SELECT ${COLUMNS} FROM important_dates WHERE relationship_id = ?1 AND deleted_at IS NULL ORDER BY event_date LIMIT 500`)
        .bind(relationshipId)
        .all<ImportantDateRow>();
      return results;
    },

    find(relationshipId: string, id: string): Promise<ImportantDateRow | null> {
      return db
        .prepare(`SELECT ${COLUMNS} FROM important_dates WHERE id = ?1 AND relationship_id = ?2 AND deleted_at IS NULL`)
        .bind(id, relationshipId)
        .first<ImportantDateRow>();
    },

    async create(id: string, relationshipId: string, createdBy: string, input: ImportantDateInput): Promise<void> {
      await db
        .prepare(
          `INSERT INTO important_dates (id, relationship_id, created_by, title, date_type, event_date, recurs_yearly, emoji, notes)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
        )
        .bind(id, relationshipId, createdBy, input.title, input.type, input.eventDate, input.recursYearly ? 1 : 0, input.emoji, input.notes)
        .run();
    },

    async update(id: string, relationshipId: string, input: ImportantDateInput): Promise<void> {
      await db
        .prepare(
          `UPDATE important_dates SET title = ?1, date_type = ?2, event_date = ?3, recurs_yearly = ?4, emoji = ?5, notes = ?6,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ?7 AND relationship_id = ?8 AND deleted_at IS NULL`,
        )
        .bind(input.title, input.type, input.eventDate, input.recursYearly ? 1 : 0, input.emoji, input.notes, id, relationshipId)
        .run();
    },

    async softDelete(id: string, relationshipId: string): Promise<void> {
      await db
        .prepare(
          `UPDATE important_dates SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ?1 AND relationship_id = ?2 AND deleted_at IS NULL`,
        )
        .bind(id, relationshipId)
        .run();
    },
  };
}
