-- Migration 0008: notificaciones push (fase 13).
--
-- Web Push estándar (VAPID), sin Firebase: el navegador entrega una "suscripción" (una URL de su
-- servicio de push y dos claves públicas) y el Worker manda ahí los avisos cifrados.

-- Un dispositivo/navegador donde alguien activó los avisos.
CREATE TABLE push_subscriptions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL UNIQUE,      -- URL del servicio de push del navegador
  p256dh          TEXT NOT NULL,             -- clave pública del navegador (base64url)
  auth            TEXT NOT NULL,             -- secreto de autenticación del navegador (base64url)
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_success_at TEXT
);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id, created_at);

-- Qué avisos quiere cada persona (en todos sus dispositivos). Sin fila = todos activados.
CREATE TABLE push_preferences (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  letters    INTEGER NOT NULL DEFAULT 1 CHECK (letters IN (0, 1)),
  memories   INTEGER NOT NULL DEFAULT 1 CHECK (memories IN (0, 1)),
  capsules   INTEGER NOT NULL DEFAULT 1 CHECK (capsules IN (0, 1)),
  dates      INTEGER NOT NULL DEFAULT 1 CHECK (dates IN (0, 1)),
  plans      INTEGER NOT NULL DEFAULT 1 CHECK (plans IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Avisos ya enviados: cada aviso tiene una clave única ("letter-unlock:<id>", "date:<id>:2026-11-02"...)
-- para no mandarlo dos veces aunque el cron corra cada 15 minutos o una petición se repita.
CREATE TABLE push_sent (
  key        TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_push_sent_created ON push_sent(created_at);
