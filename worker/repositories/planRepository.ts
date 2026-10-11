import type { PhotoRef, PlanDetail, PlanStatusName, PlanSummary, PlanTypeName } from "@shared/api";
import type { PlanInput } from "@shared/schemas";

interface SummaryRow {
  id: string;
  plan_type: PlanTypeName;
  status: PlanStatusName;
  title: string;
  planned_for: string | null;
  budget_cents: number | null;
  currency: string | null;
  place_name: string | null;
  completed_at: string | null;
  created_at: string;
  resulting_memory_id: string | null;
  cover_id: string | null;
  cover_width: number | null;
  cover_height: number | null;
  photo_count: number;
}

// La portada es la primera foto; el recuerdo resultante solo cuenta si no se borró.
const SUMMARY_COLUMNS = `p.id, p.plan_type, p.status, p.title, p.planned_for, p.budget_cents, p.currency, p.place_name,
  p.completed_at, p.created_at, rm.id AS resulting_memory_id,
  c.id AS cover_id, c.width AS cover_width, c.height AS cover_height,
  (SELECT COUNT(*) FROM plan_photos pp JOIN media_objects mo ON mo.id = pp.media_id AND mo.deleted_at IS NULL
   WHERE pp.plan_id = p.id) AS photo_count`;

const JOINS = `LEFT JOIN memories rm ON rm.id = p.resulting_memory_id AND rm.deleted_at IS NULL
  LEFT JOIN media_objects c ON c.id = (
    SELECT pp.media_id FROM plan_photos pp
    JOIN media_objects mo ON mo.id = pp.media_id AND mo.deleted_at IS NULL
    WHERE pp.plan_id = p.id ORDER BY pp.sort_order LIMIT 1
  )`;

/** Tope de seguridad: son los planes de una pareja, no hace falta paginar. */
const LIST_LIMIT = 500;

function toSummary(row: SummaryRow): PlanSummary {
  return {
    id: row.id,
    type: row.plan_type,
    status: row.status,
    title: row.title,
    plannedFor: row.planned_for,
    budget: row.budget_cents !== null && row.currency ? { amountCents: row.budget_cents, currency: row.currency } : null,
    placeName: row.place_name,
    completedAt: row.completed_at,
    cover: row.cover_id ? { id: row.cover_id, width: row.cover_width, height: row.cover_height } : null,
    photoCount: row.photo_count,
    resultingMemoryId: row.resulting_memory_id,
    createdAt: row.created_at,
  };
}

export function createPlanRepository(db: D1Database) {
  const photoStatements = (planId: string, photoIds: string[]) =>
    photoIds.map((mediaId, index) =>
      db.prepare("INSERT INTO plan_photos (plan_id, media_id, sort_order) VALUES (?1, ?2, ?3)").bind(planId, mediaId, index),
    );

  return {
    /** Pendientes primero (por fecha, los que no tienen al final); realizados y cancelados, los más recientes primero. */
    async list(relationshipId: string): Promise<PlanSummary[]> {
      const { results } = await db
        .prepare(
          `SELECT ${SUMMARY_COLUMNS} FROM plans p ${JOINS}
           WHERE p.relationship_id = ?1 AND p.deleted_at IS NULL
           ORDER BY CASE p.status WHEN 'pending' THEN 0 WHEN 'done' THEN 1 ELSE 2 END,
             CASE WHEN p.status = 'pending' THEN p.planned_for IS NULL END,
             CASE WHEN p.status = 'pending' THEN p.planned_for END,
             COALESCE(p.completed_at, p.updated_at) DESC, p.created_at DESC
           LIMIT ${LIST_LIMIT}`,
        )
        .bind(relationshipId)
        .all<SummaryRow>();
      return results.map(toSummary);
    },

    async findDetail(relationshipId: string, planId: string): Promise<PlanDetail | null> {
      const [planResult, photosResult] = await db.batch([
        db
          .prepare(
            `SELECT ${SUMMARY_COLUMNS}, p.description, p.updated_at, p.created_by, u.display_name AS author_name
             FROM plans p ${JOINS} JOIN users u ON u.id = p.created_by
             WHERE p.id = ?1 AND p.relationship_id = ?2 AND p.deleted_at IS NULL`,
          )
          .bind(planId, relationshipId),
        db
          .prepare(
            `SELECT mo.id, mo.width, mo.height FROM plan_photos pp
             JOIN media_objects mo ON mo.id = pp.media_id AND mo.deleted_at IS NULL
             JOIN plans p ON p.id = pp.plan_id AND p.relationship_id = ?2
             WHERE pp.plan_id = ?1 ORDER BY pp.sort_order`,
          )
          .bind(planId, relationshipId),
      ]);
      const row = planResult?.results[0] as
        | (SummaryRow & { description: string | null; updated_at: string; created_by: string; author_name: string })
        | undefined;
      if (!row) return null;
      return {
        ...toSummary(row),
        description: row.description,
        photos: (photosResult?.results ?? []) as PhotoRef[],
        author: { id: row.created_by, displayName: row.author_name },
        updatedAt: row.updated_at,
      };
    },

    async exists(relationshipId: string, planId: string): Promise<boolean> {
      const row = await db
        .prepare("SELECT 1 AS found FROM plans WHERE id = ?1 AND relationship_id = ?2 AND deleted_at IS NULL")
        .bind(planId, relationshipId)
        .first();
      return row !== null;
    },

    async create(planId: string, relationshipId: string, createdBy: string, input: PlanInput): Promise<void> {
      await db.batch([
        db
          .prepare(
            `INSERT INTO plans (id, relationship_id, created_by, plan_type, title, description, planned_for, budget_cents, currency, place_name)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
          )
          .bind(
            planId,
            relationshipId,
            createdBy,
            input.type,
            input.title,
            input.description,
            input.plannedFor,
            input.budgetCents,
            input.currency,
            input.placeName,
          ),
        ...photoStatements(planId, input.photoIds),
      ]);
    },

    /** Reemplaza los campos y las fotos (el estado se cambia aparte). */
    async update(planId: string, relationshipId: string, input: PlanInput): Promise<void> {
      await db.batch([
        db
          .prepare(
            `UPDATE plans SET plan_type = ?1, title = ?2, description = ?3, planned_for = ?4, budget_cents = ?5, currency = ?6,
               place_name = ?7, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?8 AND relationship_id = ?9 AND deleted_at IS NULL`,
          )
          .bind(
            input.type,
            input.title,
            input.description,
            input.plannedFor,
            input.budgetCents,
            input.currency,
            input.placeName,
            planId,
            relationshipId,
          ),
        db.prepare("DELETE FROM plan_photos WHERE plan_id = ?1").bind(planId),
        ...photoStatements(planId, input.photoIds),
      ]);
    },

    /** Al marcarlo realizado se guarda cuándo; al volver a pendiente o cancelarlo se borra. */
    async setStatus(planId: string, relationshipId: string, status: PlanStatusName): Promise<void> {
      await db
        .prepare(
          `UPDATE plans SET status = ?1,
             completed_at = CASE WHEN ?1 = 'done' THEN COALESCE(completed_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ELSE NULL END,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ?2 AND relationship_id = ?3 AND deleted_at IS NULL`,
        )
        .bind(status, planId, relationshipId)
        .run();
    },

    /** Sentencia para enlazar el recuerdo creado (va en el mismo batch que el recuerdo). */
    linkMemoryStatement(planId: string, relationshipId: string, memoryId: string): D1PreparedStatement {
      return db
        .prepare(
          `UPDATE plans SET resulting_memory_id = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ?2 AND relationship_id = ?3`,
        )
        .bind(memoryId, planId, relationshipId);
    },

    async softDelete(relationshipId: string, planId: string): Promise<void> {
      await db
        .prepare(
          `UPDATE plans SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ?1 AND relationship_id = ?2 AND deleted_at IS NULL`,
        )
        .bind(planId, relationshipId)
        .run();
    },

    /** Planes pendientes con fecha desde hoy, para "Próximo momento". */
    async listUpcoming(relationshipId: string, today: string): Promise<{ id: string; title: string; plan_type: PlanTypeName; planned_for: string }[]> {
      const { results } = await db
        .prepare(
          `SELECT id, title, plan_type, planned_for FROM plans
           WHERE relationship_id = ?1 AND deleted_at IS NULL AND status = 'pending' AND planned_for >= ?2
           ORDER BY planned_for LIMIT 5`,
        )
        .bind(relationshipId, today)
        .all<{ id: string; title: string; plan_type: PlanTypeName; planned_for: string }>();
      return results;
    },
  };
}
