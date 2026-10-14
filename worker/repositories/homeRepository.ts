import type { HighlightedMemory, HomeCorners } from "@shared/api";

export function createHomeRepository(db: D1Database) {
  return {
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

    /** Lo que se asoma en cada rincón del inicio: las últimas fotos, el último dibujo, la última canción… */
    async cornerPreviews(relationshipId: string, today: string): Promise<HomeCorners> {
      const [counts, photos, drawing, song] = await db.batch<Record<string, unknown>>([
        db
          .prepare(
            `SELECT
               (SELECT COUNT(*) FROM memories WHERE relationship_id = ?1 AND deleted_at IS NULL) AS memories,
               (SELECT COUNT(*) FROM letters WHERE relationship_id = ?1 AND deleted_at IS NULL) AS letters,
               (SELECT COUNT(*) FROM plans WHERE relationship_id = ?1 AND deleted_at IS NULL AND status = 'pending') AS plans_pending,
               (SELECT COUNT(*) FROM plans WHERE relationship_id = ?1 AND deleted_at IS NULL AND status = 'done') AS plans_done,
               (SELECT COUNT(*) FROM future_capsules WHERE relationship_id = ?1 AND deleted_at IS NULL) AS capsules,
               (SELECT COUNT(*) FROM important_dates WHERE relationship_id = ?1 AND deleted_at IS NULL) AS dates,
               (SELECT COUNT(*) FROM drawings WHERE relationship_id = ?1 AND deleted_at IS NULL) AS drawings,
               (SELECT COUNT(*) FROM songs WHERE relationship_id = ?1 AND deleted_at IS NULL) AS songs,
               (SELECT MIN(planned_for) FROM plans WHERE relationship_id = ?1 AND deleted_at IS NULL AND status = 'pending'
                  AND planned_for >= ?2) AS next_plan_on`,
          )
          .bind(relationshipId, today),
        // La portada de los últimos recuerdos con foto, uno por recuerdo.
        db
          .prepare(
            `SELECT mo.id, mo.width, mo.height FROM memories m
             JOIN media_objects mo ON mo.id = (
               SELECT mp.media_id FROM memory_photos mp
               JOIN media_objects x ON x.id = mp.media_id AND x.deleted_at IS NULL
               WHERE mp.memory_id = m.id ORDER BY mp.sort_order LIMIT 1
             )
             WHERE m.relationship_id = ?1 AND m.deleted_at IS NULL
             ORDER BY m.happened_on DESC, m.created_at DESC
             LIMIT 3`,
          )
          .bind(relationshipId),
        db
          .prepare(`SELECT id FROM drawings WHERE relationship_id = ?1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`)
          .bind(relationshipId),
        db
          .prepare(
            `SELECT title, artist, thumbnail_url FROM songs WHERE relationship_id = ?1 AND deleted_at IS NULL
             ORDER BY created_at DESC LIMIT 1`,
          )
          .bind(relationshipId),
      ]);
      const n = (counts?.results[0] ?? {}) as Record<string, number | string | null>;
      const num = (key: string) => Number(n[key] ?? 0);
      const latestSong = song?.results[0] as { title: string | null; artist: string | null; thumbnail_url: string | null } | undefined;
      return {
        memories: {
          count: num("memories"),
          photos: ((photos?.results ?? []) as { id: string; width: number | null; height: number | null }[]).map((p) => ({ id: p.id, width: p.width, height: p.height })),
        },
        letters: { count: num("letters") },
        plans: { pending: num("plans_pending"), done: num("plans_done"), nextOn: (n.next_plan_on as string | null) ?? null },
        future: { count: num("capsules") },
        us: { count: num("dates") },
        drawings: { count: num("drawings"), latestId: ((drawing?.results[0] as { id: string } | undefined)?.id) ?? null },
        songs: {
          count: num("songs"),
          latest: latestSong ? { title: latestSong.title, artist: latestSong.artist, thumbnailUrl: latestSong.thumbnail_url } : null,
        },
      };
    },
  };
}
