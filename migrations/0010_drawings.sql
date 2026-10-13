-- Migration 0010: fotos de dibujos para dejarse el uno al otro.
--
-- La imagen vive en R2 (clave generada por el Worker) y solo se sirve por /api/drawings,
-- que comprueba que sea de la misma pareja.
CREATE TABLE drawings (
  id              TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  author_id       TEXT NOT NULL REFERENCES users(id),
  r2_key          TEXT NOT NULL UNIQUE,
  thumb_r2_key    TEXT,
  content_type    TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL CHECK (size_bytes > 0),
  width           INTEGER,
  height          INTEGER,
  caption         TEXT CHECK (caption IS NULL OR length(caption) <= 140),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at      TEXT
);
CREATE INDEX idx_drawings_recent ON drawings(relationship_id, created_at DESC) WHERE deleted_at IS NULL;

-- Avisos de dibujos nuevos (activados por defecto, como los demás).
ALTER TABLE push_preferences ADD COLUMN drawings INTEGER NOT NULL DEFAULT 1 CHECK (drawings IN (0, 1));

-- section_visits gana la sección "drawings": SQLite no cambia un CHECK, se rehace la tabla.
CREATE TABLE section_visits_new (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section  TEXT NOT NULL CHECK (section IN ('memories', 'plans', 'us', 'drawings')),
  seen_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, section)
);
INSERT INTO section_visits_new (user_id, section, seen_at) SELECT user_id, section, seen_at FROM section_visits;
DROP TABLE section_visits;
ALTER TABLE section_visits_new RENAME TO section_visits;
