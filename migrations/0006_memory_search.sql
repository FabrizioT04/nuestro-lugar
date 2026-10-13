-- Migration 0006: búsqueda de recuerdos con IA (fase 11).
--
-- Cada recuerdo se convierte en un vector (Workers AI) que vive en Vectorize; el texto sigue solo en D1.
-- search_indexed_at guarda el updated_at del recuerdo cuando se indexó: si no coincide con el actual
-- (recuerdo nuevo o editado), hay que volver a indexarlo. NULL = nunca indexado o ya quitado del índice.
ALTER TABLE memories ADD COLUMN search_indexed_at TEXT;

CREATE INDEX idx_memories_search_pending ON memories(relationship_id, search_indexed_at);
