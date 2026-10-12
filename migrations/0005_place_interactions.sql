-- Migration 0005: "¿Qué hacemos hoy?" (fase 10).
--
-- place_interactions guarda lo que cada uno marca en un lugar de Google (me interesa, fuimos,
-- nos encantó...). De Google solo se guarda el Place ID; la categoría es nuestra (cafe, park...)
-- y sirve para aprender qué tipo de lugares les gustan sin volver a consultar a Google.
ALTER TABLE place_interactions ADD COLUMN category TEXT
  CHECK (category IS NULL OR category IN ('cafe', 'dessert', 'restaurant', 'bar', 'park', 'culture', 'cinema', 'viewpoint', 'activity'));

-- Cada marca es un interruptor: una sola fila por persona, lugar y tipo.
DELETE FROM place_interactions
WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM place_interactions GROUP BY user_id, google_place_id, interaction_type
);
CREATE UNIQUE INDEX idx_place_interactions_unique ON place_interactions(user_id, google_place_id, interaction_type);
CREATE INDEX idx_place_interactions_category ON place_interactions(relationship_id, category);
