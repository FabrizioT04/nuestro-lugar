export interface NewMedia {
  id: string;
  relationshipId: string;
  uploadedBy: string;
  r2Key: string;
  thumbR2Key: string | null;
  purpose: "memory" | "plan" | "capsule" | "avatar" | "cover" | "intro";
  contentType: string;
  sizeBytes: number;
  thumbSizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

export interface MediaRow {
  id: string;
  r2_key: string;
  thumb_r2_key: string | null;
  purpose: string;
  width: number | null;
  height: number | null;
}

export function createMediaRepository(db: D1Database) {
  return {
    async insert(media: NewMedia): Promise<void> {
      await db
        .prepare(
          `INSERT INTO media_objects
             (id, relationship_id, uploaded_by, r2_key, thumb_r2_key, purpose, content_type, size_bytes, thumb_size_bytes, width, height, duration_ms)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
        )
        .bind(
          media.id,
          media.relationshipId,
          media.uploadedBy,
          media.r2Key,
          media.thumbR2Key,
          media.purpose,
          media.contentType,
          media.sizeBytes,
          media.thumbSizeBytes,
          media.width,
          media.height,
          media.durationMs,
        )
        .run();
    },

    /** Solo devuelve el archivo si pertenece a la relación indicada. */
    async findInRelationship(id: string, relationshipId: string): Promise<MediaRow | null> {
      return db
        .prepare(
          `SELECT id, r2_key, thumb_r2_key, purpose, width, height FROM media_objects
           WHERE id = ?1 AND relationship_id = ?2 AND deleted_at IS NULL`,
        )
        .bind(id, relationshipId)
        .first<MediaRow>();
    },

    /** Cuántos de los ids dados son fotos válidas de esta relación para el propósito indicado. */
    async countOwned(ids: string[], relationshipId: string, purposes: string[]): Promise<number> {
      if (ids.length === 0) return 0;
      const row = await db
        .prepare(
          `SELECT COUNT(*) AS total FROM media_objects
           WHERE relationship_id = ?1 AND deleted_at IS NULL
             AND id IN (SELECT value FROM json_each(?2))
             AND purpose IN (SELECT value FROM json_each(?3))`,
        )
        .bind(relationshipId, JSON.stringify(ids), JSON.stringify(purposes))
        .first<{ total: number }>();
      return row?.total ?? 0;
    },
  };
}
