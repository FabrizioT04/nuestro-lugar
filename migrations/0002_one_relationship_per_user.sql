-- Migration 0002: cada usuario pertenece como máximo a una relación.
-- Además evita que dos configuraciones iniciales simultáneas creen dos relaciones:
-- la segunda falla de forma atómica al insertar el miembro repetido.
CREATE UNIQUE INDEX idx_relationship_members_one_per_user ON relationship_members(user_id);
DROP INDEX idx_relationship_members_user;
