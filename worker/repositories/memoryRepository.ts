import type { MemoryDetail, MemorySummary, PhotoRef } from "@shared/api";
import type { MemoryInput } from "@shared/schemas";

// Columnas comunes para listados y detalle. ?1 = user_id (para saber si es favorito).
const SUMMARY_COLUMNS = `
  m.id, m.title, m.happened_on, m.place_name, m.category, m.is_highlighted, m.created_at,
  EXISTS (
    SELECT 1 FROM favorites f WHERE f.user_id = ?1 AND f.entity_type = 'memory' AND f.entity_id = m.id
  ) AS is_favorite,
  (SELECT COUNT(*) FROM memory_photos mp
     JOIN media_objects mo ON mo.id = mp.media_id AND mo.deleted_at IS NULL
     WHERE mp.memory_id = m.id) AS photo_count,
  (SELECT json_group_array(name) FROM (
     SELECT t.name FROM memory_tags mt JOIN tags t ON t.id = mt.tag_id
     WHERE mt.memory_id = m.id ORDER BY t.name)) AS tags_json,
  c.id AS cover_id, c.width AS cover_width, c.height AS cover_height`;

const COVER_JOIN = `
  LEFT JOIN media_objects c ON c.id = (
    SELECT mp.media_id FROM memory_photos mp
    JOIN media_objects mo ON mo.id = mp.media_id AND mo.deleted_at IS NULL
    WHERE mp.memory_id = m.id ORDER BY mp.sort_order LIMIT 1
  )`;

interface SummaryRow {
  id: string;
  title: string;
  happened_on: string;
  place_name: string | null;
  category: string | null;
  is_highlighted: number;
  created_at: string;
  is_favorite: number;
  photo_count: number;
  tags_json: string;
  cover_id: string | null;
  cover_width: number | null;
  cover_height: number | null;
}

const toSummary = (row: SummaryRow): MemorySummary => ({
  id: row.id,
  title: row.title,
  happenedOn: row.happened_on,
  placeName: row.place_name,
  category: row.category,
  tags: JSON.parse(row.tags_json) as string[],
  isFavorite: row.is_favorite === 1,
  isHighlighted: row.is_highlighted === 1,
  cover: row.cover_id ? { id: row.cover_id, width: row.cover_width, height: row.cover_height } : null,
  photoCount: row.photo_count,
});

/** Escapa % y _ para que la búsqueda trate el texto del usuario de forma literal. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export interface ListFilters {
  q?: string;
  category?: string;
  tag?: string;
  favoritesOnly?: boolean;
  after?: { happenedOn: string; createdAt: string; id: string };
  limit: number;
}

export interface MemoryCursor {
  happenedOn: string;
  createdAt: string;
  id: string;
}

export function createMemoryRepository(db: D1Database) {
  /** Sentencias que reescriben etiquetas y fotos de un recuerdo (usadas al crear y editar). */
  function childStatements(memoryId: string, relationshipId: string, input: MemoryInput): D1PreparedStatement[] {
    const statements: D1PreparedStatement[] = [];
    for (const name of input.tags) {
      statements.push(
        db
          .prepare("INSERT INTO tags (id, relationship_id, name) VALUES (?1, ?2, ?3) ON CONFLICT(relationship_id, name) DO NOTHING")
          .bind(crypto.randomUUID(), relationshipId, name),
        db
          .prepare("INSERT INTO memory_tags (memory_id, tag_id) SELECT ?1, id FROM tags WHERE relationship_id = ?2 AND name = ?3")
          .bind(memoryId, relationshipId, name),
      );
    }
    input.photoIds.forEach((mediaId, index) => {
      statements.push(
        db.prepare("INSERT INTO memory_photos (memory_id, media_id, sort_order) VALUES (?1, ?2, ?3)").bind(memoryId, mediaId, index),
      );
    });
    if (input.isHighlighted) {
      // Solo un recuerdo destacado a la vez.
      statements.push(
        db
          .prepare("UPDATE memories SET is_highlighted = 0 WHERE relationship_id = ?1 AND id != ?2 AND is_highlighted = 1")
          .bind(relationshipId, memoryId),
      );
    }
    return statements;
  }

  return {
    async list(userId: string, relationshipId: string, filters: ListFilters): Promise<{ items: MemorySummary[]; last: MemoryCursor | null; hasMore: boolean }> {
      const where = ["m.relationship_id = ?2", "m.deleted_at IS NULL"];
      const binds: unknown[] = [userId, relationshipId];
      const param = (value: unknown) => {
        binds.push(value);
        return `?${binds.length}`;
      };

      if (filters.q) {
        const p = param(likePattern(filters.q));
        where.push(`(m.title LIKE ${p} ESCAPE '\\' OR m.description LIKE ${p} ESCAPE '\\' OR m.place_name LIKE ${p} ESCAPE '\\'
          OR EXISTS (SELECT 1 FROM memory_tags mt JOIN tags t ON t.id = mt.tag_id WHERE mt.memory_id = m.id AND t.name LIKE ${p} ESCAPE '\\'))`);
      }
      if (filters.category) where.push(`m.category = ${param(filters.category)}`);
      if (filters.tag) {
        where.push(`EXISTS (SELECT 1 FROM memory_tags mt JOIN tags t ON t.id = mt.tag_id WHERE mt.memory_id = m.id AND t.name = ${param(filters.tag)})`);
      }
      if (filters.favoritesOnly) {
        where.push("EXISTS (SELECT 1 FROM favorites f WHERE f.user_id = ?1 AND f.entity_type = 'memory' AND f.entity_id = m.id)");
      }
      if (filters.after) {
        where.push(`(m.happened_on, m.created_at, m.id) < (${param(filters.after.happenedOn)}, ${param(filters.after.createdAt)}, ${param(filters.after.id)})`);
      }

      const sql = `SELECT ${SUMMARY_COLUMNS} FROM memories m ${COVER_JOIN}
        WHERE ${where.join(" AND ")}
        ORDER BY m.happened_on DESC, m.created_at DESC, m.id DESC
        LIMIT ${param(filters.limit + 1)}`;

      const { results } = await db.prepare(sql).bind(...binds).all<SummaryRow>();
      const hasMore = results.length > filters.limit;
      const page = results.slice(0, filters.limit);
      const lastRow = page.at(-1);
      return {
        items: page.map(toSummary),
        last: lastRow ? { happenedOn: lastRow.happened_on, createdAt: lastRow.created_at, id: lastRow.id } : null,
        hasMore,
      };
    },

    async findDetail(userId: string, relationshipId: string, memoryId: string): Promise<MemoryDetail | null> {
      const [memoryResult, photosResult] = await db.batch([
        db
          .prepare(
            `SELECT ${SUMMARY_COLUMNS}, m.description, m.updated_at, m.author_id, u.display_name AS author_name
             FROM memories m ${COVER_JOIN} JOIN users u ON u.id = m.author_id
             WHERE m.id = ?3 AND m.relationship_id = ?2 AND m.deleted_at IS NULL`,
          )
          .bind(userId, relationshipId, memoryId),
        db
          .prepare(
            `SELECT mo.id, mo.width, mo.height FROM memory_photos mp
             JOIN media_objects mo ON mo.id = mp.media_id AND mo.deleted_at IS NULL
             JOIN memories m ON m.id = mp.memory_id AND m.relationship_id = ?2
             WHERE mp.memory_id = ?1 ORDER BY mp.sort_order`,
          )
          .bind(memoryId, relationshipId),
      ]);
      const row = memoryResult?.results[0] as
        | (SummaryRow & { description: string | null; updated_at: string; author_id: string; author_name: string })
        | undefined;
      if (!row) return null;
      return {
        ...toSummary(row),
        description: row.description,
        photos: (photosResult?.results ?? []) as PhotoRef[],
        author: { id: row.author_id, displayName: row.author_name },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },

    async exists(relationshipId: string, memoryId: string): Promise<boolean> {
      const row = await db
        .prepare("SELECT 1 AS found FROM memories WHERE id = ?1 AND relationship_id = ?2 AND deleted_at IS NULL")
        .bind(memoryId, relationshipId)
        .first();
      return row !== null;
    },

    /** Crea el recuerdo con sus etiquetas y fotos en una sola transacción. */
    async create(memoryId: string, relationshipId: string, authorId: string, input: MemoryInput): Promise<void> {
      await db.batch([
        db
          .prepare(
            `INSERT INTO memories (id, relationship_id, author_id, title, description, happened_on, category, place_name, is_highlighted)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
          )
          .bind(
            memoryId,
            relationshipId,
            authorId,
            input.title,
            input.description,
            input.happenedOn,
            input.category,
            input.placeName,
            input.isHighlighted ? 1 : 0,
          ),
        ...childStatements(memoryId, relationshipId, input),
      ]);
    },

    /** Reemplaza todos los campos, etiquetas y fotos del recuerdo en una sola transacción. */
    async update(memoryId: string, relationshipId: string, input: MemoryInput): Promise<void> {
      await db.batch([
        db
          .prepare(
            `UPDATE memories SET title = ?1, description = ?2, happened_on = ?3, category = ?4, place_name = ?5,
               is_highlighted = ?6, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?7 AND relationship_id = ?8 AND deleted_at IS NULL`,
          )
          .bind(
            input.title,
            input.description,
            input.happenedOn,
            input.category,
            input.placeName,
            input.isHighlighted ? 1 : 0,
            memoryId,
            relationshipId,
          ),
        db.prepare("DELETE FROM memory_tags WHERE memory_id = ?1").bind(memoryId),
        db.prepare("DELETE FROM memory_photos WHERE memory_id = ?1").bind(memoryId),
        ...childStatements(memoryId, relationshipId, input),
      ]);
    },

    /** Borrado lógico: el recuerdo deja de verse pero sus datos y fotos se conservan. */
    async softDelete(relationshipId: string, memoryId: string): Promise<void> {
      await db
        .prepare(
          `UPDATE memories SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), is_highlighted = 0
           WHERE id = ?1 AND relationship_id = ?2 AND deleted_at IS NULL`,
        )
        .bind(memoryId, relationshipId)
        .run();
    },

    async setFavorite(userId: string, memoryId: string, favorite: boolean): Promise<void> {
      const statement = favorite
        ? db.prepare("INSERT INTO favorites (user_id, entity_type, entity_id) VALUES (?1, 'memory', ?2) ON CONFLICT DO NOTHING")
        : db.prepare("DELETE FROM favorites WHERE user_id = ?1 AND entity_type = 'memory' AND entity_id = ?2");
      await statement.bind(userId, memoryId).run();
    },

    async filters(relationshipId: string): Promise<{ categories: string[]; tags: string[] }> {
      const [categories, tags] = await db.batch([
        db
          .prepare(
            `SELECT DISTINCT category FROM memories
             WHERE relationship_id = ?1 AND deleted_at IS NULL AND category IS NOT NULL ORDER BY category`,
          )
          .bind(relationshipId),
        db
          .prepare(
            `SELECT DISTINCT t.name FROM tags t
             JOIN memory_tags mt ON mt.tag_id = t.id
             JOIN memories m ON m.id = mt.memory_id AND m.deleted_at IS NULL
             WHERE t.relationship_id = ?1 ORDER BY t.name`,
          )
          .bind(relationshipId),
      ]);
      return {
        categories: ((categories?.results ?? []) as { category: string }[]).map((r) => r.category),
        tags: ((tags?.results ?? []) as { name: string }[]).map((r) => r.name),
      };
    },
  };
}
