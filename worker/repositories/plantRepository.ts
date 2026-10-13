export interface PlantRow {
  name: string;
  planted_on: string;
}

export interface PlantCare {
  care_days: number;
  last_day: string | null;
}

export function createPlantRepository(db: D1Database) {
  return {
    /** La plantita de la pareja; la siembra (hoy) la primera vez que alguien la mira. */
    async findOrPlant(relationshipId: string, today: string): Promise<PlantRow> {
      await db.prepare("INSERT OR IGNORE INTO plants (relationship_id, planted_on) VALUES (?1, ?2)").bind(relationshipId, today).run();
      const row = await db.prepare("SELECT name, planted_on FROM plants WHERE relationship_id = ?1").bind(relationshipId).first<PlantRow>();
      return row!;
    },

    async care(relationshipId: string): Promise<PlantCare> {
      const row = await db
        .prepare("SELECT COUNT(DISTINCT day) AS care_days, MAX(day) AS last_day FROM plant_waterings WHERE relationship_id = ?1")
        .bind(relationshipId)
        .first<PlantCare>();
      return { care_days: row?.care_days ?? 0, last_day: row?.last_day ?? null };
    },

    /** Quiénes la regaron ese día. */
    async waterersOn(relationshipId: string, day: string): Promise<string[]> {
      const { results } = await db
        .prepare("SELECT user_id FROM plant_waterings WHERE relationship_id = ?1 AND day = ?2")
        .bind(relationshipId, day)
        .all<{ user_id: string }>();
      return results.map((row) => row.user_id);
    },

    /** false si esa persona ya la había regado ese día. */
    async water(relationshipId: string, userId: string, day: string): Promise<boolean> {
      const result = await db
        .prepare("INSERT OR IGNORE INTO plant_waterings (relationship_id, user_id, day) VALUES (?1, ?2, ?3)")
        .bind(relationshipId, userId, day)
        .run();
      return (result.meta.changes ?? 0) > 0;
    },

    async rename(relationshipId: string, name: string): Promise<void> {
      await db.prepare("UPDATE plants SET name = ?2 WHERE relationship_id = ?1").bind(relationshipId, name).run();
    },
  };
}
