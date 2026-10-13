import type { SeenSection } from "@shared/schemas";

export interface BadgeCounts {
  memories: number;
  plans: number;
  us: number;
  capsules: number;
  drawings: number;
}

export function createBadgeRepository(db: D1Database) {
  return {
    /**
     * Novedades de la otra persona: recuerdos, planes, fechas y dibujos creados después de la última visita
     * a cada sección, y cápsulas que ya se pueden abrir y nadie abrió.
     */
    async counts(relationshipId: string, userId: string, now: string): Promise<BadgeCounts> {
      const seen = (section: SeenSection) =>
        `COALESCE((SELECT seen_at FROM section_visits WHERE user_id = ?2 AND section = '${section}'), '')`;
      const row = await db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM memories WHERE relationship_id = ?1 AND deleted_at IS NULL
                AND author_id <> ?2 AND created_at > ${seen("memories")}) AS memories,
             (SELECT COUNT(*) FROM plans WHERE relationship_id = ?1 AND deleted_at IS NULL
                AND created_by <> ?2 AND created_at > ${seen("plans")}) AS plans,
             (SELECT COUNT(*) FROM important_dates WHERE relationship_id = ?1 AND deleted_at IS NULL
                AND created_by <> ?2 AND created_at > ${seen("us")}) AS us,
             (SELECT COUNT(*) FROM future_capsules WHERE relationship_id = ?1 AND deleted_at IS NULL
                AND created_by <> ?2 AND opened_at IS NULL AND unlock_at <= ?3) AS capsules,
             (SELECT COUNT(*) FROM drawings WHERE relationship_id = ?1 AND deleted_at IS NULL
                AND author_id <> ?2 AND created_at > ${seen("drawings")}) AS drawings`,
        )
        .bind(relationshipId, userId, now)
        .first<BadgeCounts>();
      return { memories: row?.memories ?? 0, plans: row?.plans ?? 0, us: row?.us ?? 0, capsules: row?.capsules ?? 0, drawings: row?.drawings ?? 0 };
    },

    async markSeen(userId: string, section: SeenSection, now: string): Promise<void> {
      await db
        .prepare(
          `INSERT INTO section_visits (user_id, section, seen_at) VALUES (?1, ?2, ?3)
           ON CONFLICT (user_id, section) DO UPDATE SET seen_at = excluded.seen_at`,
        )
        .bind(userId, section, now)
        .run();
    },
  };
}
