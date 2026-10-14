-- Migration 0011: canciones que se recomiendan el uno al otro.
--
-- Se guarda el enlace limpio de Spotify o YouTube; el título y la portada se piden una vez
-- al crearla (oEmbed, sin claves). La otra persona la marca como escuchada al abrir el reproductor.
CREATE TABLE songs (
  id              TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  author_id       TEXT NOT NULL REFERENCES users(id),
  provider        TEXT NOT NULL CHECK (provider IN ('spotify', 'youtube')),
  url             TEXT NOT NULL CHECK (length(url) <= 300),
  title           TEXT CHECK (title IS NULL OR length(title) <= 200),
  artist          TEXT CHECK (artist IS NULL OR length(artist) <= 200),
  thumbnail_url   TEXT CHECK (thumbnail_url IS NULL OR length(thumbnail_url) <= 500),
  note            TEXT CHECK (note IS NULL OR length(note) <= 280),
  listened_at     TEXT,
  loved           INTEGER NOT NULL DEFAULT 0 CHECK (loved IN (0, 1)),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at      TEXT
);
CREATE INDEX idx_songs_recent ON songs(relationship_id, created_at DESC) WHERE deleted_at IS NULL;

-- Avisos de canciones (activados por defecto, como los demás).
ALTER TABLE push_preferences ADD COLUMN songs INTEGER NOT NULL DEFAULT 1 CHECK (songs IN (0, 1));
