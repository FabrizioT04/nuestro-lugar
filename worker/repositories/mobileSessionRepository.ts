// Intentos de inicio de sesión y sesiones de la app móvil (ver migrations/0007_mobile_sessions.sql).
// Solo se guardan hashes: con la base de datos no se puede entrar en nombre de nadie.

export interface LoginRequestRow {
  id: string;
  app_challenge: string;
  google_verifier: string;
  nonce: string;
  user_id: string | null;
  expires_at: string;
  used_at: string | null;
}

export interface MobileSessionRow {
  id: string;
  user_id: string;
  refresh_hash: string;
  previous_refresh_hash: string | null;
  rotated_at: string;
  expires_at: string;
  revoked_at: string | null;
}

const iso = (ms: number) => new Date(ms).toISOString();

export function createMobileSessionRepository(db: D1Database) {
  return {
    async createLoginRequest(input: { id: string; appChallenge: string; googleVerifier: string; nonce: string; now: number; ttlMs: number }) {
      await db.batch([
        // De paso se limpian los intentos vencidos (son pocos: dos personas).
        db.prepare("DELETE FROM mobile_login_requests WHERE expires_at < ?1").bind(iso(input.now)),
        db
          .prepare(
            `INSERT INTO mobile_login_requests (id, app_challenge, google_verifier, nonce, created_at, expires_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
          )
          .bind(input.id, input.appChallenge, input.googleVerifier, input.nonce, iso(input.now), iso(input.now + input.ttlMs)),
      ]);
    },

    findLoginRequest(id: string): Promise<LoginRequestRow | null> {
      return db
        .prepare("SELECT id, app_challenge, google_verifier, nonce, user_id, expires_at, used_at FROM mobile_login_requests WHERE id = ?1")
        .bind(id)
        .first<LoginRequestRow>();
    },

    /** Google ya confirmó quién es: se guarda el usuario y el hash del código de un solo uso para la app. */
    async completeLoginRequest(id: string, userId: string, loginCodeHash: string, expiresAt: number): Promise<boolean> {
      const result = await db
        .prepare(
          `UPDATE mobile_login_requests SET user_id = ?2, login_code_hash = ?3, expires_at = ?4
           WHERE id = ?1 AND user_id IS NULL AND used_at IS NULL`,
        )
        .bind(id, userId, loginCodeHash, iso(expiresAt))
        .run();
      return result.meta.changes === 1;
    },

    findByLoginCode(loginCodeHash: string): Promise<LoginRequestRow | null> {
      return db
        .prepare(
          "SELECT id, app_challenge, google_verifier, nonce, user_id, expires_at, used_at FROM mobile_login_requests WHERE login_code_hash = ?1",
        )
        .bind(loginCodeHash)
        .first<LoginRequestRow>();
    },

    /** Marca el código como usado. Devuelve false si otra petición lo usó primero. */
    async consumeLoginRequest(id: string, now: number): Promise<boolean> {
      const result = await db
        .prepare("UPDATE mobile_login_requests SET used_at = ?2 WHERE id = ?1 AND used_at IS NULL")
        .bind(id, iso(now))
        .run();
      return result.meta.changes === 1;
    },

    async createSession(input: { id: string; userId: string; refreshHash: string; now: number; ttlMs: number }) {
      const now = iso(input.now);
      await db
        .prepare(
          `INSERT INTO mobile_sessions (id, user_id, refresh_hash, rotated_at, created_at, last_used_at, expires_at)
           VALUES (?1, ?2, ?3, ?4, ?4, ?4, ?5)`,
        )
        .bind(input.id, input.userId, input.refreshHash, now, iso(input.now + input.ttlMs))
        .run();
    },

    findSession(id: string): Promise<MobileSessionRow | null> {
      return db
        .prepare(
          "SELECT id, user_id, refresh_hash, previous_refresh_hash, rotated_at, expires_at, revoked_at FROM mobile_sessions WHERE id = ?1",
        )
        .bind(id)
        .first<MobileSessionRow>();
    },

    /** Busca por el refresh token actual o por el anterior (para detectar reusos). */
    findSessionByRefreshHash(hash: string): Promise<MobileSessionRow | null> {
      return db
        .prepare(
          `SELECT id, user_id, refresh_hash, previous_refresh_hash, rotated_at, expires_at, revoked_at FROM mobile_sessions
           WHERE refresh_hash = ?1 OR previous_refresh_hash = ?1`,
        )
        .bind(hash)
        .first<MobileSessionRow>();
    },

    /**
     * Rota el refresh token solo si sigue siendo el que se presentó (si dos peticiones llegan
     * a la vez, solo una gana). La sesión se extiende: abrir la app la mantiene viva.
     */
    async rotate(id: string, presentedHash: string, newHash: string, now: number, ttlMs: number): Promise<boolean> {
      const result = await db
        .prepare(
          `UPDATE mobile_sessions
           SET previous_refresh_hash = ?2, refresh_hash = ?3, rotated_at = ?4, last_used_at = ?4, expires_at = ?5
           WHERE id = ?1 AND revoked_at IS NULL AND (refresh_hash = ?2 OR previous_refresh_hash = ?2)`,
        )
        .bind(id, presentedHash, newHash, iso(now), iso(now + ttlMs))
        .run();
      return result.meta.changes === 1;
    },

    async revoke(id: string, now: number): Promise<void> {
      await db.prepare("UPDATE mobile_sessions SET revoked_at = ?2 WHERE id = ?1 AND revoked_at IS NULL").bind(id, iso(now)).run();
    },
  };
}
