import type { AuthenticatedUser } from "../auth/types";

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  intro_seen_at: string | null;
  relationship_id: string | null;
}

const toUser = (row: UserRow): AuthenticatedUser => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  introSeenAt: row.intro_seen_at,
  relationshipId: row.relationship_id,
});

const SELECT_USER = `
  SELECT u.id, u.email, u.display_name, u.intro_seen_at, m.relationship_id
  FROM users u
  LEFT JOIN relationship_members m ON m.user_id = u.id
  WHERE u.email = ?1`;

export function createUserRepository(db: D1Database) {
  return {
    async findByEmail(email: string): Promise<AuthenticatedUser | null> {
      const row = await db.prepare(SELECT_USER).bind(email).first<UserRow>();
      return row ? toUser(row) : null;
    },

    /** Crea el usuario la primera vez que entra. Idempotente si dos peticiones llegan a la vez. */
    async findOrCreate(email: string): Promise<AuthenticatedUser> {
      const existing = await this.findByEmail(email);
      if (existing) return existing;

      const initialName = email.split("@")[0] ?? email;
      await db
        .prepare("INSERT INTO users (id, email, display_name) VALUES (?1, ?2, ?3) ON CONFLICT(email) DO NOTHING")
        .bind(crypto.randomUUID(), email, initialName)
        .run();

      const created = await this.findByEmail(email);
      if (!created) throw new Error("No se pudo crear el usuario");
      return created;
    },

    async markIntroSeen(userId: string): Promise<void> {
      await db
        .prepare(
          "UPDATE users SET intro_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1 AND intro_seen_at IS NULL",
        )
        .bind(userId)
        .run();
    },

    async touchLastSeen(userId: string): Promise<void> {
      await db
        .prepare("UPDATE users SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1")
        .bind(userId)
        .run();
    },
  };
}
