-- Migration 0003: miniatura para cada foto (galerías rápidas sin descargar la foto completa).
-- La miniatura vive en R2 junto al original; NULL para archivos sin miniatura (audios).
ALTER TABLE media_objects ADD COLUMN thumb_r2_key TEXT;
ALTER TABLE media_objects ADD COLUMN thumb_size_bytes INTEGER;
