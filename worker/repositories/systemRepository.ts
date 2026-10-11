// Repositorio: único lugar donde se escribe SQL. Siempre con prepared statements
// (`prepare(...).bind(...)`), nunca concatenando valores en el texto de la consulta.
export function createSystemRepository(db: D1Database) {
  return {
    async countTables(): Promise<number> {
      const row = await db
        .prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = ?1 AND name NOT LIKE ?2 AND name NOT LIKE ?3")
        .bind("table", "sqlite_%", "_cf_%")
        .first<{ total: number }>();
      return row?.total ?? 0;
    },
  };
}
