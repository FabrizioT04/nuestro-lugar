import type { LetterTypeName } from "@shared/api";

export interface LetterRow {
  id: string;
  letter_type: LetterTypeName;
  title: string;
  open_when_label: string | null;
  unlock_at: string | null;
  opened_at: string | null;
  created_at: string;
  updated_at: string;
  author_id: string;
  author_name: string;
  recipient_id: string;
  recipient_name: string;
}

export interface LetterRowWithBody extends LetterRow {
  body: string;
}

export interface LetterWrite {
  type: LetterTypeName;
  title: string;
  body: string;
  openWhenLabel: string | null;
  unlockAt: string | null;
}

// El cuerpo (body) nunca se selecciona en los listados.
const COLUMNS = `l.id, l.letter_type, l.title, l.open_when_label, l.unlock_at, l.opened_at, l.created_at, l.updated_at,
  l.author_id, a.display_name AS author_name, l.recipient_id, r.display_name AS recipient_name`;

const JOINS = `JOIN users a ON a.id = l.author_id JOIN users r ON r.id = l.recipient_id`;

/** Tope de seguridad del listado: son cartas entre dos personas, no hace falta paginar. */
const LIST_LIMIT = 300;

export function createLetterRepository(db: D1Database) {
  return {
    /**
     * Recibidas: las sorpresas no aparecen hasta su fecha (ni siquiera el título).
     * Enviadas: todas las que escribió quien pregunta.
     */
    async list(relationshipId: string, userId: string, box: "received" | "sent", now: string): Promise<LetterRow[]> {
      const filter =
        box === "received"
          ? "l.recipient_id = ?2 AND NOT (l.letter_type = 'surprise' AND l.unlock_at > ?3)"
          : "l.author_id = ?2";
      const statement = db.prepare(
        `SELECT ${COLUMNS} FROM letters l ${JOINS}
         WHERE l.relationship_id = ?1 AND l.deleted_at IS NULL AND ${filter}
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT ${LIST_LIMIT}`,
      );
      const { results } = await (box === "received"
        ? statement.bind(relationshipId, userId, now)
        : statement.bind(relationshipId, userId)
      ).all<LetterRow>();
      return results;
    },

    /** Pendientes visibles para Inicio: filtrar y ordenar antes de limitar. Nunca incluye el cuerpo. */
    async listPending(relationshipId: string, userId: string, now: string, limit: number): Promise<LetterRow[]> {
      const { results } = await db
        .prepare(
          `SELECT ${COLUMNS} FROM letters l ${JOINS}
           WHERE l.relationship_id = ?1 AND l.deleted_at IS NULL
             AND l.recipient_id = ?2 AND l.author_id <> ?2 AND l.opened_at IS NULL
             AND NOT (l.letter_type = 'surprise' AND l.unlock_at > ?3)
           ORDER BY CASE WHEN l.unlock_at > ?3 THEN 1 ELSE 0 END,
             COALESCE(l.unlock_at, ''), l.created_at DESC, l.id DESC
           LIMIT ?4`,
        )
        .bind(relationshipId, userId, now, limit)
        .all<LetterRow>();
      return results;
    },

    /** Incluye el cuerpo: el servicio decide si se puede devolver. */
    findWithBody(relationshipId: string, letterId: string): Promise<LetterRowWithBody | null> {
      return db
        .prepare(
          `SELECT ${COLUMNS}, l.body FROM letters l ${JOINS}
           WHERE l.id = ?1 AND l.relationship_id = ?2 AND l.deleted_at IS NULL`,
        )
        .bind(letterId, relationshipId)
        .first<LetterRowWithBody>();
    },

    async create(id: string, relationshipId: string, authorId: string, recipientId: string, letter: LetterWrite): Promise<void> {
      await db
        .prepare(
          `INSERT INTO letters (id, relationship_id, author_id, recipient_id, letter_type, title, open_when_label, body, unlock_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
        )
        .bind(id, relationshipId, authorId, recipientId, letter.type, letter.title, letter.openWhenLabel, letter.body, letter.unlockAt)
        .run();
    },

    /** Solo el autor y solo mientras no se haya abierto. Devuelve false si no se actualizó nada. */
    async update(relationshipId: string, letterId: string, authorId: string, letter: LetterWrite): Promise<boolean> {
      const result = await db
        .prepare(
          `UPDATE letters SET letter_type = ?1, title = ?2, open_when_label = ?3, body = ?4, unlock_at = ?5,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ?6 AND relationship_id = ?7 AND author_id = ?8 AND opened_at IS NULL AND deleted_at IS NULL`,
        )
        .bind(letter.type, letter.title, letter.openWhenLabel, letter.body, letter.unlockAt, letterId, relationshipId, authorId)
        .run();
      return result.meta.changes > 0;
    },

    /** Marca la primera apertura. Solo el destinatario y solo si ya está desbloqueada. Idempotente. */
    async markOpened(relationshipId: string, letterId: string, recipientId: string, now: string): Promise<void> {
      await db
        .prepare(
          `UPDATE letters SET opened_at = ?4
           WHERE id = ?1 AND relationship_id = ?2 AND recipient_id = ?3 AND deleted_at IS NULL
             AND opened_at IS NULL AND (unlock_at IS NULL OR unlock_at <= ?4)`,
        )
        .bind(letterId, relationshipId, recipientId, now)
        .run();
    },

    async softDelete(relationshipId: string, letterId: string, authorId: string): Promise<void> {
      await db
        .prepare(
          `UPDATE letters SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ?1 AND relationship_id = ?2 AND author_id = ?3 AND deleted_at IS NULL`,
        )
        .bind(letterId, relationshipId, authorId)
        .run();
    },

    /** Cartas recibidas que ya se pueden abrir y siguen cerradas. */
    async countUnopened(relationshipId: string, recipientId: string, now: string): Promise<number> {
      const row = await db
        .prepare(
          `SELECT COUNT(*) AS total FROM letters
           WHERE relationship_id = ?1 AND recipient_id = ?2 AND deleted_at IS NULL
             AND opened_at IS NULL AND (unlock_at IS NULL OR unlock_at <= ?3)`,
        )
        .bind(relationshipId, recipientId, now)
        .first<{ total: number }>();
      return row?.total ?? 0;
    },
  };
}
