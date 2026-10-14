import type { PushPreferences } from "@shared/api";

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PreferencesRow {
  letters: number;
  memories: number;
  capsules: number;
  dates: number;
  plans: number;
  drawings: number;
  songs: number;
}

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = { letters: true, memories: true, capsules: true, dates: true, plans: true, drawings: true, songs: true };

/** Como mucho estos dispositivos por persona; al pasarse se olvida el más antiguo. */
export const MAX_SUBSCRIPTIONS_PER_USER = 10;

export function createPushRepository(db: D1Database) {
  return {
    /** Guarda (o reasigna) la suscripción de un navegador. Una URL de push = un dispositivo. */
    async upsertSubscription(userId: string, endpoint: string, p256dh: string, auth: string): Promise<void> {
      await db.batch([
        db
          .prepare(
            `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
          )
          .bind(crypto.randomUUID(), userId, endpoint, p256dh, auth),
        db
          .prepare(
            `DELETE FROM push_subscriptions WHERE user_id = ?1 AND id NOT IN (
               SELECT id FROM push_subscriptions WHERE user_id = ?1 ORDER BY created_at DESC, id LIMIT ${MAX_SUBSCRIPTIONS_PER_USER})`,
          )
          .bind(userId),
      ]);
    },

    async deleteSubscription(userId: string, endpoint: string): Promise<void> {
      await db.prepare("DELETE FROM push_subscriptions WHERE user_id = ?1 AND endpoint = ?2").bind(userId, endpoint).run();
    },

    async deleteSubscriptionById(id: string): Promise<void> {
      await db.prepare("DELETE FROM push_subscriptions WHERE id = ?1").bind(id).run();
    },

    async hasSubscription(userId: string, endpoint: string): Promise<boolean> {
      const row = await db.prepare("SELECT 1 AS found FROM push_subscriptions WHERE user_id = ?1 AND endpoint = ?2").bind(userId, endpoint).first();
      return row !== null;
    },

    async listSubscriptions(userIds: string[]): Promise<PushSubscriptionRow[]> {
      if (userIds.length === 0) return [];
      const placeholders = userIds.map((_, i) => `?${i + 1}`).join(", ");
      const { results } = await db
        .prepare(`SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id IN (${placeholders})`)
        .bind(...userIds)
        .all<PushSubscriptionRow>();
      return results;
    },

    async markDelivered(ids: string[], now: string): Promise<void> {
      if (ids.length === 0) return;
      await db.batch(ids.map((id) => db.prepare("UPDATE push_subscriptions SET last_success_at = ?2 WHERE id = ?1").bind(id, now)));
    },

    async getPreferences(userId: string): Promise<PushPreferences> {
      const row = await db
        .prepare("SELECT letters, memories, capsules, dates, plans, drawings, songs FROM push_preferences WHERE user_id = ?1")
        .bind(userId)
        .first<PreferencesRow>();
      if (!row) return { ...DEFAULT_PUSH_PREFERENCES };
      return { letters: row.letters === 1, memories: row.memories === 1, capsules: row.capsules === 1, dates: row.dates === 1, plans: row.plans === 1, drawings: row.drawings === 1, songs: row.songs === 1 };
    },

    async setPreferences(userId: string, prefs: PushPreferences): Promise<void> {
      const b = (value: boolean) => (value ? 1 : 0);
      await db
        .prepare(
          `INSERT INTO push_preferences (user_id, letters, memories, capsules, dates, plans, drawings, songs) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
           ON CONFLICT (user_id) DO UPDATE SET letters = excluded.letters, memories = excluded.memories, capsules = excluded.capsules,
             dates = excluded.dates, plans = excluded.plans, drawings = excluded.drawings, songs = excluded.songs, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .bind(userId, b(prefs.letters), b(prefs.memories), b(prefs.capsules), b(prefs.dates), b(prefs.plans), b(prefs.drawings), b(prefs.songs))
        .run();
    },

    /** Reserva la clave de un aviso. false = ya se envió antes (o lo está enviando otra ejecución). */
    async claim(key: string): Promise<boolean> {
      const result = await db.prepare("INSERT OR IGNORE INTO push_sent (key) VALUES (?1)").bind(key).run();
      return (result.meta.changes ?? 0) > 0;
    },

    async pruneSent(before: string): Promise<void> {
      await db.prepare("DELETE FROM push_sent WHERE created_at < ?1").bind(before).run();
    },

    // ----- Lo que revisa el cron -----

    async listRelationships(): Promise<{ id: string; started_on: string; timezone: string }[]> {
      const { results } = await db.prepare("SELECT id, started_on, timezone FROM relationships LIMIT 100").all<{ id: string; started_on: string; timezone: string }>();
      return results;
    },

    async listMembers(relationshipId: string): Promise<{ id: string; display_name: string }[]> {
      const { results } = await db
        .prepare(
          `SELECT u.id, u.display_name FROM relationship_members m JOIN users u ON u.id = m.user_id
           WHERE m.relationship_id = ?1 ORDER BY m.joined_at, u.id`,
        )
        .bind(relationshipId)
        .all<{ id: string; display_name: string }>();
      return results;
    },

    /** Cartas con fecha de apertura que llegó entre `since` y `now` y que nadie abrió todavía. */
    async listUnlockedLetters(relationshipId: string, since: string, now: string) {
      const { results } = await db
        .prepare(
          `SELECT l.id, l.recipient_id, u.display_name AS author_name FROM letters l JOIN users u ON u.id = l.author_id
           WHERE l.relationship_id = ?1 AND l.deleted_at IS NULL AND l.opened_at IS NULL
             AND l.unlock_at IS NOT NULL AND l.unlock_at > ?2 AND l.unlock_at <= ?3
           LIMIT 50`,
        )
        .bind(relationshipId, since, now)
        .all<{ id: string; recipient_id: string; author_name: string }>();
      return results;
    },

    async listUnlockedCapsules(relationshipId: string, since: string, now: string) {
      const { results } = await db
        .prepare(
          `SELECT id, title, recipient_id FROM future_capsules
           WHERE relationship_id = ?1 AND deleted_at IS NULL AND opened_at IS NULL AND unlock_at > ?2 AND unlock_at <= ?3
           LIMIT 50`,
        )
        .bind(relationshipId, since, now)
        .all<{ id: string; title: string; recipient_id: string | null }>();
      return results;
    },

    async listPlansOn(relationshipId: string, day: string) {
      const { results } = await db
        .prepare(
          `SELECT id, title FROM plans
           WHERE relationship_id = ?1 AND deleted_at IS NULL AND status = 'pending' AND planned_for = ?2
           ORDER BY created_at LIMIT 10`,
        )
        .bind(relationshipId, day)
        .all<{ id: string; title: string }>();
      return results;
    },
  };
}
