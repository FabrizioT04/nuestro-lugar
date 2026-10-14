export interface SongRow {
  id: string;
  author_id: string;
  author_name: string;
  provider: "spotify" | "youtube";
  url: string;
  title: string | null;
  artist: string | null;
  thumbnail_url: string | null;
  note: string | null;
  listened_at: string | null;
  loved: number;
  created_at: string;
}

export interface NewSong {
  id: string;
  relationshipId: string;
  authorId: string;
  provider: "spotify" | "youtube";
  url: string;
  title: string | null;
  artist: string | null;
  thumbnailUrl: string | null;
  note: string | null;
}

const COLUMNS = `s.id, s.author_id, u.display_name AS author_name, s.provider, s.url, s.title, s.artist, s.thumbnail_url,
  s.note, s.listened_at, s.loved, s.created_at`;

export function createSongRepository(db: D1Database) {
  return {
    async insert(song: NewSong): Promise<void> {
      await db
        .prepare(
          `INSERT INTO songs (id, relationship_id, author_id, provider, url, title, artist, thumbnail_url, note)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
        )
        .bind(song.id, song.relationshipId, song.authorId, song.provider, song.url, song.title, song.artist, song.thumbnailUrl, song.note)
        .run();
    },

    async list(relationshipId: string, limit: number): Promise<SongRow[]> {
      const { results } = await db
        .prepare(
          `SELECT ${COLUMNS} FROM songs s JOIN users u ON u.id = s.author_id
           WHERE s.relationship_id = ?1 AND s.deleted_at IS NULL
           ORDER BY s.created_at DESC, s.id LIMIT ?2`,
        )
        .bind(relationshipId, limit)
        .all<SongRow>();
      return results;
    },

    find(relationshipId: string, id: string): Promise<SongRow | null> {
      return db
        .prepare(
          `SELECT ${COLUMNS} FROM songs s JOIN users u ON u.id = s.author_id
           WHERE s.id = ?1 AND s.relationship_id = ?2 AND s.deleted_at IS NULL`,
        )
        .bind(id, relationshipId)
        .first<SongRow>();
    },

    /** La primera vez que la otra persona abre el reproductor. */
    async markListened(relationshipId: string, id: string, now: string): Promise<void> {
      await db
        .prepare("UPDATE songs SET listened_at = ?3 WHERE id = ?1 AND relationship_id = ?2 AND listened_at IS NULL")
        .bind(id, relationshipId, now)
        .run();
    },

    async setLoved(relationshipId: string, id: string, loved: boolean, now: string): Promise<void> {
      await db
        .prepare("UPDATE songs SET loved = ?3, listened_at = COALESCE(listened_at, ?4) WHERE id = ?1 AND relationship_id = ?2")
        .bind(id, relationshipId, loved ? 1 : 0, now)
        .run();
    },

    async softDelete(relationshipId: string, id: string, now: string): Promise<void> {
      await db.prepare("UPDATE songs SET deleted_at = ?3 WHERE id = ?1 AND relationship_id = ?2").bind(id, relationshipId, now).run();
    },
  };
}
