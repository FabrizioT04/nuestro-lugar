import { z } from "zod";

// Esquemas de entrada compartidos. React los usa para validar formularios y el Worker
// los vuelve a aplicar siempre: el frontend nunca es la última palabra.

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD")
  .refine((value) => {
    // Date acepta "2024-02-31" y lo convierte en 2 de marzo; se exige que la fecha no cambie.
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, "Fecha inválida");

const ianaTimezone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Zona horaria inválida");

const personName = z.string().trim().min(1, "Escribe un nombre").max(60, "Máximo 60 caracteres");

export const relationshipSetupSchema = z.object({
  myName: personName,
  partnerName: personName,
  startedOn: isoDate.refine(
    (value) => value <= new Date().toISOString().slice(0, 10),
    "La fecha no puede estar en el futuro",
  ),
  timezone: ianaTimezone,
});

export type RelationshipSetupInput = z.infer<typeof relationshipSetupSchema>;
