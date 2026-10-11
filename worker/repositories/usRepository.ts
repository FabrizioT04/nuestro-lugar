import type { PlanTypeName } from "@shared/api";

export interface StatsRow {
  memories: number;
  photos: number;
  places: number;
  plans_done: number;
  letters_opened: number;
  favorites: number;
}

export interface TimelineMemoryRow {
  id: string;
  title: string;
  happened_on: string;
  place_name: string | null;
  cover_id: string | null;
  cover_width: number | null;
  cover_height: number | null;
}

export interface TimelinePlanRow {
  id: string;
  title: string;
  plan_type: PlanTypeName;
  planned_for: string | null;
  completed_at: string;
  place_name: string | null;
  cover_id: string | null;
  cover_width: number | null;
  cover_height: number | null;
}

/** Favorito de cualquiera de los dos miembros de la relación ?1. */
const FAVORITE_OF_COUPLE = `EXISTS (
  SELECT 1 FROM favorites f JOIN relationship_members rm ON rm.user_id = f.user_id AND rm.relationship_id = ?1
  WHERE f.entity_type = 'memory' AND f.entity_id = m.id)`;

/** Tope de seguridad para la línea de tiempo. */
const TIMELINE_LIMIT = 2000;

export function createUsRepository(db: D1Database) {
  return {
    /** Contadores reales, sin puntuaciones: solo lo que existe en la base de datos. */
    async stats(relationshipId: string): Promise<StatsRow> {
      const row = await db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM memories WHERE relationship_id = ?1 AND deleted_at IS NULL) AS memories,
             (SELECT COUNT(*) FROM (
                SELECT mp.media_id FROM memory_photos mp
                  JOIN memories m ON m.id = mp.memory_id AND m.relationship_id = ?1 AND m.deleted_at IS NULL
                UNION
                SELECT pp.media_id FROM plan_photos pp
                  JOIN plans p ON p.id = pp.plan_id AND p.relationship_id = ?1 AND p.deleted_at IS NULL
              ) photos JOIN media_objects mo ON mo.id = photos.media_id AND mo.deleted_at IS NULL) AS photos,
             (SELECT COUNT(DISTINCT lower(trim(place))) FROM (
                SELECT place_name AS place FROM memories
                  WHERE relationship_id = ?1 AND deleted_at IS NULL AND place_name IS NOT NULL
                UNION ALL
                SELECT place_name FROM plans
                  WHERE relationship_id = ?1 AND deleted_at IS NULL AND status = 'done' AND place_name IS NOT NULL
              )) AS places,
             (SELECT COUNT(*) FROM plans WHERE relationship_id = ?1 AND deleted_at IS NULL AND status = 'done') AS plans_done,
             (SELECT COUNT(*) FROM letters WHERE relationship_id = ?1 AND deleted_at IS NULL AND opened_at IS NOT NULL) AS letters_opened,
             (SELECT COUNT(*) FROM memories m WHERE m.relationship_id = ?1 AND m.deleted_at IS NULL AND ${FAVORITE_OF_COUPLE}) AS favorites`,
        )
        .bind(relationshipId)
        .first<StatsRow>();
      return row ?? { memories: 0, photos: 0, places: 0, plans_done: 0, letters_opened: 0, favorites: 0 };
    },

    /** Recuerdos y planes realizados (que no se convirtieron en recuerdo) para la línea de tiempo. */
    async timelineSources(relationshipId: string): Promise<{ memories: TimelineMemoryRow[]; plans: TimelinePlanRow[] }> {
      const cover = (photosTable: string, ownerColumn: string, alias: string) => `
        LEFT JOIN media_objects c ON c.id = (
          SELECT x.media_id FROM ${photosTable} x
          JOIN media_objects mo ON mo.id = x.media_id AND mo.deleted_at IS NULL
          WHERE x.${ownerColumn} = ${alias}.id ORDER BY x.sort_order LIMIT 1
        )`;
      const [memories, plans] = await db.batch([
        db
          .prepare(
            `SELECT m.id, m.title, m.happened_on, m.place_name, c.id AS cover_id, c.width AS cover_width, c.height AS cover_height
             FROM memories m ${cover("memory_photos", "memory_id", "m")}
             WHERE m.relationship_id = ?1 AND m.deleted_at IS NULL
             ORDER BY m.happened_on, m.created_at LIMIT ${TIMELINE_LIMIT}`,
          )
          .bind(relationshipId),
        db
          .prepare(
            `SELECT p.id, p.title, p.plan_type, p.planned_for, p.completed_at, p.place_name,
               c.id AS cover_id, c.width AS cover_width, c.height AS cover_height
             FROM plans p ${cover("plan_photos", "plan_id", "p")}
             LEFT JOIN memories rm ON rm.id = p.resulting_memory_id AND rm.deleted_at IS NULL
             WHERE p.relationship_id = ?1 AND p.deleted_at IS NULL AND p.status = 'done' AND rm.id IS NULL
             ORDER BY p.completed_at LIMIT ${TIMELINE_LIMIT}`,
          )
          .bind(relationshipId),
      ]);
      return {
        memories: (memories?.results ?? []) as TimelineMemoryRow[],
        plans: (plans?.results ?? []) as TimelinePlanRow[],
      };
    },
  };
}
