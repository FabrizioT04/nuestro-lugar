-- Migration 0009: globitos de novedades en los rincones del inicio.
--
-- Guarda cuándo cada persona entró por última vez a cada sección. Lo que la otra persona creó
-- después de esa hora cuenta como novedad.
CREATE TABLE section_visits (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section  TEXT NOT NULL CHECK (section IN ('memories', 'plans', 'us')),
  seen_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, section)
);

-- Lo que ya existía no cuenta como nuevo: se arranca con todo visto.
INSERT INTO section_visits (user_id, section, seen_at)
  SELECT u.id, s.section, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM users u, (SELECT 'memories' AS section UNION ALL SELECT 'plans' UNION ALL SELECT 'us') s;
