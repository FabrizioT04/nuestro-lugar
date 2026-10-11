export interface CapsuleRow {
  id: string;
  title: string;
  /** NULL = para los dos. */
  recipient_id: string | null;
  unlock_at: string;
  opened_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  author_name: string;
}

export interface CapsuleRowWithContents extends CapsuleRow {
  message: string | null;
  letter: string | null;
}

export interface CapsuleMediaRow {
  id: string;
  kind: "photo" | "audio";
  width: number | null;
  height: number | null;
  duration_ms: number | null;
}

export interface CapsuleWrite {
  recipientId: string | null;
  title: string;
  message: string | null;
  letter: string | null;
  unlockAt: string;
  photoIds: string[];
  audioId: string | null;
}

// El contenido (message, letter) nunca se selecciona en los listados.
const COLUMNS = `c.id, c.title, c.recipient_id, c.unlock_at, c.opened_at, c.created_at, c.updated_at,
  c.created_by, u.display_name AS author_name`;

/** Condición SQL: la cápsula existe, es de esa persona y sigue cerrada en ese instante (parámetros numerados). */
const editable = (capsule: string, createdBy: string, now: string) =>
  `EXISTS (SELECT 1 FROM future_capsules WHERE id = ${capsule} AND created_by = ${createdBy} AND unlock_at > ${now} AND deleted_at IS NULL)`;

/** Tope de seguridad del listado: son cápsulas entre dos personas, no hace falta paginar. */
const LIST_LIMIT = 300;

export function createCapsuleRepository(db: D1Database) {
  /**
   * Enlaza fotos y audio. Con `guard`, cada inserción comprueba en la misma sentencia que la
   * cápsula siga siendo editable por esa persona (si el UPDATE no aplicó, no se enlaza nada).
   */
  const mediaStatements = (capsuleId: string, capsule: CapsuleWrite, guard?: { createdBy: string; now: string }) => {
    const items = [
      ...capsule.photoIds.map((mediaId, index) => ({ mediaId, kind: "photo", order: index })),
      ...(capsule.audioId ? [{ mediaId: capsule.audioId, kind: "audio", order: 0 }] : []),
    ];
    return items.map(({ mediaId, kind, order }) =>
      guard
        ? db
            .prepare(
              `INSERT INTO capsule_media (capsule_id, media_id, kind, sort_order)
               SELECT ?1, ?2, ?3, ?4 WHERE ${editable("?1", "?5", "?6")}`,
            )
            .bind(capsuleId, mediaId, kind, order, guard.createdBy, guard.now)
        : db
            .prepare("INSERT INTO capsule_media (capsule_id, media_id, kind, sort_order) VALUES (?1, ?2, ?3, ?4)")
            .bind(capsuleId, mediaId, kind, order),
    );
  };

  return {
    /** Todas las cápsulas de la relación: entre dos personas, cada una es "mía" o "para mí/nosotros". */
    async list(relationshipId: string): Promise<CapsuleRow[]> {
      const { results } = await db
        .prepare(
          `SELECT ${COLUMNS} FROM future_capsules c JOIN users u ON u.id = c.created_by
           WHERE c.relationship_id = ?1 AND c.deleted_at IS NULL
           ORDER BY c.unlock_at, c.id
           LIMIT ${LIST_LIMIT}`,
        )
        .bind(relationshipId)
        .all<CapsuleRow>();
      return results;
    },

    /** Incluye el contenido: el servicio decide si se puede devolver. */
    findWithContents(relationshipId: string, capsuleId: string): Promise<CapsuleRowWithContents | null> {
      return db
        .prepare(
          `SELECT ${COLUMNS}, c.message, c.letter FROM future_capsules c JOIN users u ON u.id = c.created_by
           WHERE c.id = ?1 AND c.relationship_id = ?2 AND c.deleted_at IS NULL`,
        )
        .bind(capsuleId, relationshipId)
        .first<CapsuleRowWithContents>();
    },

    async listMedia(capsuleId: string): Promise<CapsuleMediaRow[]> {
      const { results } = await db
        .prepare(
          `SELECT mo.id, cm.kind, mo.width, mo.height, mo.duration_ms FROM capsule_media cm
           JOIN media_objects mo ON mo.id = cm.media_id AND mo.deleted_at IS NULL
           WHERE cm.capsule_id = ?1 ORDER BY cm.kind DESC, cm.sort_order`,
        )
        .bind(capsuleId)
        .all<CapsuleMediaRow>();
      return results;
    },

    /** Un archivo concreto, solo si está dentro de esta cápsula. */
    findMediaInCapsule(capsuleId: string, mediaId: string): Promise<{ r2_key: string; thumb_r2_key: string | null } | null> {
      return db
        .prepare(
          `SELECT mo.r2_key, mo.thumb_r2_key FROM capsule_media cm
           JOIN media_objects mo ON mo.id = cm.media_id AND mo.deleted_at IS NULL
           WHERE cm.capsule_id = ?1 AND cm.media_id = ?2`,
        )
        .bind(capsuleId, mediaId)
        .first<{ r2_key: string; thumb_r2_key: string | null }>();
    },

    /**
     * Cuántos de los ids se pueden meter en la cápsula: archivos de cápsula del tipo pedido,
     * subidos por esta misma persona y que no estén ya dentro de otra cápsula.
     */
    async countLinkable(ids: string[], relationshipId: string, uploadedBy: string, kind: "photo" | "audio", capsuleId: string | null): Promise<number> {
      if (ids.length === 0) return 0;
      const row = await db
        .prepare(
          `SELECT COUNT(*) AS total FROM media_objects mo
           WHERE mo.relationship_id = ?1 AND mo.uploaded_by = ?2 AND mo.purpose = 'capsule' AND mo.deleted_at IS NULL
             AND mo.content_type LIKE ?3
             AND mo.id IN (SELECT value FROM json_each(?4))
             AND NOT EXISTS (SELECT 1 FROM capsule_media cm WHERE cm.media_id = mo.id AND cm.capsule_id IS NOT ?5)`,
        )
        .bind(relationshipId, uploadedBy, kind === "photo" ? "image/%" : "audio/%", JSON.stringify(ids), capsuleId)
        .first<{ total: number }>();
      return row?.total ?? 0;
    },

    async create(id: string, relationshipId: string, createdBy: string, capsule: CapsuleWrite): Promise<void> {
      await db.batch([
        db
          .prepare(
            `INSERT INTO future_capsules (id, relationship_id, created_by, recipient_id, title, message, letter, unlock_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
          )
          .bind(id, relationshipId, createdBy, capsule.recipientId, capsule.title, capsule.message, capsule.letter, capsule.unlockAt),
        ...mediaStatements(id, capsule),
      ]);
    },

    /**
     * Solo quien la guardó y solo mientras siga cerrada. Devuelve false si no se actualizó nada
     * (en ese caso tampoco se tocan sus archivos).
     */
    async update(relationshipId: string, capsuleId: string, createdBy: string, capsule: CapsuleWrite, now: string): Promise<boolean> {
      const results = await db.batch([
        db
          .prepare(
            `UPDATE future_capsules SET recipient_id = ?1, title = ?2, message = ?3, letter = ?4, unlock_at = ?5,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?6 AND relationship_id = ?7 AND created_by = ?8 AND unlock_at > ?9 AND deleted_at IS NULL`,
          )
          .bind(capsule.recipientId, capsule.title, capsule.message, capsule.letter, capsule.unlockAt, capsuleId, relationshipId, createdBy, now),
        db
          .prepare(`DELETE FROM capsule_media WHERE capsule_id = ?1 AND ${editable("?1", "?2", "?3")}`)
          .bind(capsuleId, createdBy, now),
        ...mediaStatements(capsuleId, capsule, { createdBy, now }),
      ]);
      return (results[0]?.meta.changes ?? 0) > 0;
    },

    /** Marca la primera apertura. Solo quien no la guardó y solo si ya llegó su fecha. Idempotente. */
    async markOpened(relationshipId: string, capsuleId: string, viewerId: string, now: string): Promise<void> {
      await db
        .prepare(
          `UPDATE future_capsules SET opened_at = ?4
           WHERE id = ?1 AND relationship_id = ?2 AND created_by <> ?3 AND deleted_at IS NULL
             AND opened_at IS NULL AND unlock_at <= ?4`,
        )
        .bind(capsuleId, relationshipId, viewerId, now)
        .run();
    },

    async softDelete(relationshipId: string, capsuleId: string, createdBy: string): Promise<void> {
      await db
        .prepare(
          `UPDATE future_capsules SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ?1 AND relationship_id = ?2 AND created_by = ?3 AND deleted_at IS NULL`,
        )
        .bind(capsuleId, relationshipId, createdBy)
        .run();
    },
  };
}
