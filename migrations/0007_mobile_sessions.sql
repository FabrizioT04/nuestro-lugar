-- Migration 0007: inicio de sesión de la app móvil (fase 12).
--
-- Dentro de la app (Capacitor) no existen las cookies de Cloudflare Access. La app entra con
-- Google en el navegador del sistema (OAuth + PKCE) y el Worker emite sus propios tokens.
-- Aquí solo se guardan HASHES de los códigos y refresh tokens, nunca los valores.

-- Un intento de inicio de sesión: vive 10 minutos y se usa una sola vez.
CREATE TABLE mobile_login_requests (
  id               TEXT PRIMARY KEY,         -- también es el "state" de OAuth
  app_challenge    TEXT NOT NULL,            -- PKCE de la app: SHA-256 del verificador, en base64url
  google_verifier  TEXT NOT NULL,            -- PKCE del Worker con Google
  nonce            TEXT NOT NULL,
  user_id          TEXT REFERENCES users(id) ON DELETE CASCADE,
  login_code_hash  TEXT UNIQUE,              -- código de un solo uso que vuelve a la app por deep link
  created_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL,
  used_at          TEXT
);

CREATE INDEX idx_mobile_login_requests_expires ON mobile_login_requests(expires_at);

-- Una sesión por dispositivo. El refresh token rota en cada uso.
CREATE TABLE mobile_sessions (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_hash           TEXT NOT NULL UNIQUE,
  previous_refresh_hash  TEXT,               -- para tolerar un reintento justo después de rotar
  rotated_at             TEXT NOT NULL,
  created_at             TEXT NOT NULL,
  last_used_at           TEXT NOT NULL,
  expires_at             TEXT NOT NULL,
  revoked_at             TEXT
);

CREATE INDEX idx_mobile_sessions_user ON mobile_sessions(user_id);
CREATE INDEX idx_mobile_sessions_previous ON mobile_sessions(previous_refresh_hash);
