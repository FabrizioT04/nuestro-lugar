-- Migration 0004: contenido de las cápsulas del futuro.
--
-- Una cápsula puede guardar un texto (message, ya existía), una pequeña carta (letter),
-- varias fotos y un audio. Las fotos y el audio viven en R2 (media_objects con purpose='capsule')
-- y se enlazan aquí. La columna future_capsules.media_id de 0001 queda sin uso.
ALTER TABLE future_capsules ADD COLUMN letter TEXT;

CREATE TABLE capsule_media (
  capsule_id  TEXT NOT NULL REFERENCES future_capsules(id) ON DELETE CASCADE,
  media_id    TEXT NOT NULL REFERENCES media_objects(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('photo', 'audio')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (capsule_id, media_id)
);
-- Un archivo pertenece a una sola cápsula: así nadie puede "enlazar" la foto de otra cápsula
-- en una propia para verla antes de su fecha.
CREATE UNIQUE INDEX idx_capsule_media_unique ON capsule_media(media_id);
