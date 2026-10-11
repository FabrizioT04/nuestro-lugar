-- Migration 0001: esquema inicial de Nuestro Lugar.
--
-- Convenciones:
--   * IDs: TEXT (UUID v4/v7). Se pueden generar en el cliente para que el modo offline
--     cree contenido sin esperar al servidor; el Worker siempre valida y decide.
--   * Fechas-hora: TEXT ISO-8601 en UTC ("2026-10-11T06:41:23.000Z").
--   * Fechas sin hora (cumpleaños, inicio de relación): TEXT "YYYY-MM-DD".
--   * Dinero: INTEGER en centavos + moneda ISO-4217.
--   * Soft delete: columna deleted_at en el contenido importante.
--   * Las imágenes y audios viven en R2; aquí solo se guarda la clave del objeto.
--   * D1 aplica las claves foráneas por defecto.

-- ---------------------------------------------------------------------------
-- Identidad y relación
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name   TEXT NOT NULL,
  avatar_media_id TEXT,                      -- FK lógica a media_objects (se crea más abajo)
  birthday       TEXT,                       -- YYYY-MM-DD
  intro_seen_at  TEXT,                       -- NULL = mostrar la introducción
  last_seen_at   TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE relationships (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL DEFAULT 'Nuestro Lugar',
  started_on      TEXT NOT NULL,             -- YYYY-MM-DD, base para "días juntos"
  timezone        TEXT NOT NULL DEFAULT 'UTC', -- IANA (p. ej. America/Lima); se fija al crear la relación
  cover_media_id  TEXT,                      -- foto principal del Home
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Tabla puente: es la fuente de verdad para "¿este usuario pertenece a esta relación?".
CREATE TABLE relationship_members (
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (relationship_id, user_id)
);
CREATE INDEX idx_relationship_members_user ON relationship_members(user_id);

-- ---------------------------------------------------------------------------
-- Archivos (R2)
-- ---------------------------------------------------------------------------

-- Un registro por objeto subido a R2. El frontend nunca recibe URLs públicas del bucket:
-- los archivos se sirven a través del Worker, que comprueba permisos (y fechas de desbloqueo).
CREATE TABLE media_objects (
  id              TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  uploaded_by     TEXT NOT NULL REFERENCES users(id),
  r2_key          TEXT NOT NULL UNIQUE,      -- generado por el Worker, nunca por el cliente
  purpose         TEXT NOT NULL CHECK (purpose IN ('memory', 'plan', 'capsule', 'avatar', 'cover', 'intro')),
  content_type    TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL CHECK (size_bytes > 0),
  width           INTEGER,
  height          INTEGER,
  duration_ms     INTEGER,                   -- audios de cápsulas
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at      TEXT
);
CREATE INDEX idx_media_relationship ON media_objects(relationship_id, purpose);

-- ---------------------------------------------------------------------------
-- Recuerdos
-- ---------------------------------------------------------------------------

CREATE TABLE memories (
  id              TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  author_id       TEXT NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description     TEXT,
  happened_on     TEXT NOT NULL,             -- YYYY-MM-DD, ordena el timeline
  category        TEXT,
  place_name      TEXT,                      -- texto propio del usuario
  google_place_id TEXT,                      -- solo el Place ID de Google (permitido almacenarlo)
  latitude        REAL,
  longitude       REAL,
  is_highlighted  INTEGER NOT NULL DEFAULT 0 CHECK (is_highlighted IN (0, 1)), -- "recuerdo destacado"
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at      TEXT
);
CREATE INDEX idx_memories_timeline ON memories(relationship_id, happened_on DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_memories_category ON memories(relationship_id, category) WHERE deleted_at IS NULL;

CREATE TABLE memory_photos (
  memory_id   TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  media_id    TEXT NOT NULL REFERENCES media_objects(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  caption     TEXT,
  PRIMARY KEY (memory_id, media_id)
);
CREATE INDEX idx_memory_photos_order ON memory_photos(memory_id, sort_order);

CREATE TABLE tags (
  id              TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  name            TEXT NOT NULL COLLATE NOCASE CHECK (length(name) BETWEEN 1 AND 40),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (relationship_id, name)
);

CREATE TABLE memory_tags (
  memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  tag_id    TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (memory_id, tag_id)
);
CREATE INDEX idx_memory_tags_tag ON memory_tags(tag_id);

-- ---------------------------------------------------------------------------
-- Cartas
-- ---------------------------------------------------------------------------

CREATE TABLE letters (
  id              TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  author_id       TEXT NOT NULL REFERENCES users(id),
  recipient_id    TEXT NOT NULL REFERENCES users(id),
  letter_type     TEXT NOT NULL DEFAULT 'normal'
                  CHECK (letter_type IN ('normal', 'open_when', 'scheduled', 'surprise')),
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  open_when_label TEXT,                      -- "estés triste", "me extrañes"...
  body            TEXT NOT NULL,             -- el Worker NO lo devuelve antes de unlock_at
  unlock_at       TEXT,                      -- UTC; NULL = disponible de inmediato
  opened_at       TEXT,                      -- primera vez que el destinatario la abrió
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at      TEXT
);
CREATE INDEX idx_letters_recipient ON letters(relationship_id, recipient_id, created_at DESC) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Planes
-- ---------------------------------------------------------------------------

CREATE TABLE plans (
  id                  TEXT PRIMARY KEY,
  relationship_id     TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  created_by          TEXT NOT NULL REFERENCES users(id),
  plan_type           TEXT NOT NULL DEFAULT 'other'
                      CHECK (plan_type IN ('date', 'restaurant', 'trip', 'activity', 'movie', 'goal', 'place_to_visit', 'other')),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'cancelled')),
  title               TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description         TEXT,
  planned_for         TEXT,                  -- fecha u hora opcional
  budget_cents        INTEGER CHECK (budget_cents IS NULL OR budget_cents >= 0),
  currency            TEXT,                  -- ISO-4217 (PEN, USD, EUR...)
  place_name          TEXT,
  google_place_id     TEXT,
  completed_at        TEXT,
  resulting_memory_id TEXT REFERENCES memories(id) ON DELETE SET NULL, -- plan convertido en recuerdo
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at          TEXT
);
CREATE INDEX idx_plans_status ON plans(relationship_id, status, planned_for) WHERE deleted_at IS NULL;

CREATE TABLE plan_photos (
  plan_id    TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  media_id   TEXT NOT NULL REFERENCES media_objects(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (plan_id, media_id)
);

-- ---------------------------------------------------------------------------
-- Caja del futuro
-- ---------------------------------------------------------------------------

CREATE TABLE future_capsules (
  id              TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  created_by      TEXT NOT NULL REFERENCES users(id),
  recipient_id    TEXT REFERENCES users(id),  -- NULL = para los dos
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200), -- visible antes de abrir
  message         TEXT,                       -- oculto hasta unlock_at (lo filtra el Worker)
  media_id        TEXT REFERENCES media_objects(id) ON DELETE SET NULL, -- foto o audio
  unlock_at       TEXT NOT NULL,              -- UTC
  opened_at       TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at      TEXT
);
CREATE INDEX idx_capsules_unlock ON future_capsules(relationship_id, unlock_at) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Fechas importantes
-- ---------------------------------------------------------------------------

CREATE TABLE important_dates (
  id              TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  created_by      TEXT NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  date_type       TEXT NOT NULL DEFAULT 'custom'
                  CHECK (date_type IN ('anniversary', 'birthday', 'first_time', 'trip', 'custom')),
  event_date      TEXT NOT NULL,              -- YYYY-MM-DD
  recurs_yearly   INTEGER NOT NULL DEFAULT 1 CHECK (recurs_yearly IN (0, 1)),
  emoji           TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at      TEXT
);
CREATE INDEX idx_important_dates ON important_dates(relationship_id, event_date) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Lugares, preferencias y favoritos
-- ---------------------------------------------------------------------------

-- Registro de interacciones (append-only). Solo guarda el Place ID de Google más datos propios,
-- respetando las políticas de almacenamiento de Google Maps Platform.
CREATE TABLE place_interactions (
  id               TEXT PRIMARY KEY,
  relationship_id  TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id),
  google_place_id  TEXT NOT NULL,
  interaction_type TEXT NOT NULL
                   CHECK (interaction_type IN ('interested', 'not_interested', 'favorite', 'visited', 'loved', 'rated')),
  rating           INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  note             TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_place_interactions_place ON place_interactions(relationship_id, google_place_id);
CREATE INDEX idx_place_interactions_user ON place_interactions(user_id, created_at DESC);

CREATE TABLE user_preferences (
  user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  max_distance_km  REAL,
  price_level_min  INTEGER CHECK (price_level_min IS NULL OR price_level_min BETWEEN 0 AND 4),
  price_level_max  INTEGER CHECK (price_level_max IS NULL OR price_level_max BETWEEN 0 AND 4),
  liked_categories TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(liked_categories)),  -- ["cafe","italian"...]
  disliked_categories TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(disliked_categories)),
  ambience         TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(ambience)),          -- ["tranquilo","romántico"]
  dietary          TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(dietary)),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Favoritos por usuario. Polimórfica a propósito (sin FK): el Worker valida que entity_id
-- exista y pertenezca a la relación del usuario antes de insertar.
CREATE TABLE favorites (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('memory', 'letter', 'plan', 'place')),
  entity_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, entity_type, entity_id)
);
CREATE INDEX idx_favorites_entity ON favorites(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Sincronización offline (idempotencia del patrón Outbox)
-- ---------------------------------------------------------------------------

-- Cada acción que llega desde la cola offline trae un client_action_id único.
-- Si el mismo id llega dos veces (reintento), el Worker devuelve el resultado guardado
-- en lugar de repetir la operación.
CREATE TABLE sync_actions (
  client_action_id TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type      TEXT NOT NULL,             -- "memory.create", "plan.update"...
  entity_type      TEXT NOT NULL,
  entity_id        TEXT,
  status           TEXT NOT NULL CHECK (status IN ('applied', 'rejected')),
  response_json    TEXT CHECK (response_json IS NULL OR json_valid(response_json)),
  received_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_sync_actions_user ON sync_actions(user_id, received_at DESC);
