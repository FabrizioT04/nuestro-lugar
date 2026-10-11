import type { RelationshipSummary } from "@shared/api";

interface RelationshipRow {
  id: string;
  name: string;
  started_on: string;
  timezone: string;
}

interface MemberRow {
  id: string;
  display_name: string;
  email: string;
}

export interface CreateRelationshipParams {
  relationshipId: string;
  startedOn: string;
  timezone: string;
  me: { id: string; displayName: string };
  partner: { email: string; displayName: string };
}

export function createRelationshipRepository(db: D1Database) {
  return {
    async findSummary(relationshipId: string): Promise<RelationshipSummary | null> {
      const [relationship, members] = await db.batch([
        db
          .prepare("SELECT id, name, started_on, timezone FROM relationships WHERE id = ?1")
          .bind(relationshipId),
        db
          .prepare(
            `SELECT u.id, u.display_name, u.email
             FROM relationship_members m JOIN users u ON u.id = m.user_id
             WHERE m.relationship_id = ?1
             ORDER BY m.joined_at`,
          )
          .bind(relationshipId),
      ]);
      const row = relationship?.results[0] as RelationshipRow | undefined;
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        startedOn: row.started_on,
        timezone: row.timezone,
        members: ((members?.results ?? []) as MemberRow[]).map((m) => ({
          id: m.id,
          displayName: m.display_name,
          email: m.email,
        })),
      };
    },

    /**
     * Crea la relación y sus dos miembros en una sola transacción (db.batch es atómico).
     * Si alguno ya pertenece a una relación, el índice único hace fallar todo el batch.
     */
    async create(params: CreateRelationshipParams): Promise<void> {
      await db.batch([
        db
          .prepare("INSERT INTO relationships (id, started_on, timezone) VALUES (?1, ?2, ?3)")
          .bind(params.relationshipId, params.startedOn, params.timezone),
        db
          .prepare(
            "UPDATE users SET display_name = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?2",
          )
          .bind(params.me.displayName, params.me.id),
        db
          .prepare(
            `INSERT INTO users (id, email, display_name) VALUES (?1, ?2, ?3)
             ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
          )
          .bind(crypto.randomUUID(), params.partner.email, params.partner.displayName),
        db
          .prepare("INSERT INTO relationship_members (relationship_id, user_id) VALUES (?1, ?2)")
          .bind(params.relationshipId, params.me.id),
        db
          .prepare(
            "INSERT INTO relationship_members (relationship_id, user_id) SELECT ?1, id FROM users WHERE email = ?2",
          )
          .bind(params.relationshipId, params.partner.email),
      ]);
    },
  };
}
