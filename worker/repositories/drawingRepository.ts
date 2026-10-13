export interface DrawingRow {
  id: string;
  author_id: string;
  author_name: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface NewDrawing {
  id: string;
  relationshipId: string;
  authorId: string;
  r2Key: string;
  thumbR2Key: string | null;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  caption: string | null;
}

const COLUMNS = "d.id, d.author_id, u.display_name AS author_name, d.caption, d.width, d.height, d.created_at";

export function createDrawingRepository(db: D1Database) {
  return {
    async insert(drawing: NewDrawing): Promise<void> {
      await db
        .prepare(
          `INSERT INTO drawings (id, relationship_id, author_id, r2_key, thumb_r2_key, content_type, size_bytes, width, height, caption)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
        )
        .bind(
          drawing.id,
          drawing.relationshipId,
          drawing.authorId,
          drawing.r2Key,
          drawing.thumbR2Key,
          drawing.contentType,
          drawing.sizeBytes,
          drawing.width,
          drawing.height,
          drawing.caption,
        )
        .run();
    },

    async list(relationshipId: string, limit: number): Promise<DrawingRow[]> {
      const { results } = await db
        .prepare(
          `SELECT ${COLUMNS} FROM drawings d JOIN users u ON u.id = d.author_id
           WHERE d.relationship_id = ?1 AND d.deleted_at IS NULL
           ORDER BY d.created_at DESC, d.id LIMIT ?2`,
        )
        .bind(relationshipId, limit)
        .all<DrawingRow>();
      return results;
    },

    find(relationshipId: string, id: string): Promise<DrawingRow | null> {
      return db
        .prepare(
          `SELECT ${COLUMNS} FROM drawings d JOIN users u ON u.id = d.author_id
           WHERE d.id = ?1 AND d.relationship_id = ?2 AND d.deleted_at IS NULL`,
        )
        .bind(id, relationshipId)
        .first<DrawingRow>();
    },

    findKeys(relationshipId: string, id: string): Promise<{ author_id: string; r2_key: string; thumb_r2_key: string | null } | null> {
      return db
        .prepare("SELECT author_id, r2_key, thumb_r2_key FROM drawings WHERE id = ?1 AND relationship_id = ?2 AND deleted_at IS NULL")
        .bind(id, relationshipId)
        .first();
    },

    async softDelete(relationshipId: string, id: string, now: string): Promise<void> {
      await db.prepare("UPDATE drawings SET deleted_at = ?3 WHERE id = ?1 AND relationship_id = ?2").bind(id, relationshipId, now).run();
    },
  };
}
