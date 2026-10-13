-- Migration 0011: la plantita de los dos (un lirio, la flor favorita de Zuleyka).
--
-- Una por pareja. Cada persona la puede regar una vez al día (día en la zona horaria de la pareja);
-- cada día en que alguien la riega cuenta como un día de cuidado y la hace crecer.
CREATE TABLE plants (
  relationship_id TEXT PRIMARY KEY REFERENCES relationships(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT 'Nuestro lirio' CHECK (length(name) BETWEEN 1 AND 40),
  planted_on      TEXT NOT NULL,             -- YYYY-MM-DD
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE plant_waterings (
  relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day             TEXT NOT NULL,             -- YYYY-MM-DD en la zona horaria de la pareja
  watered_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (relationship_id, user_id, day)
);
CREATE INDEX idx_plant_waterings_day ON plant_waterings(relationship_id, day);
