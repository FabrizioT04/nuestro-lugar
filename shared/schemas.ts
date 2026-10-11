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

// ---------------------------------------------------------------------------
// Recuerdos
// ---------------------------------------------------------------------------

export const MEMORY_CATEGORIES = [
  "Cita",
  "Viaje",
  "Comida",
  "Aniversario",
  "Paseo",
  "En casa",
  "Celebración",
  "Especial",
] as const;

export const MAX_PHOTOS_PER_MEMORY = 20;
export const MAX_TAGS_PER_MEMORY = 10;

const uuid = z.uuid("Identificador inválido");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);

const tagName = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(40, "Cada etiqueta puede tener hasta 40 caracteres")
  .regex(/^[^,#]+$/, "Las etiquetas no pueden llevar comas ni #");

export const memoryInputSchema = z.object({
  title: z.string().trim().min(1, "Ponle un título").max(200, "Máximo 200 caracteres"),
  description: optionalText(5000),
  happenedOn: isoDate.refine(
    (value) => value <= new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    "Un recuerdo no puede ser del futuro",
  ),
  category: optionalText(40),
  placeName: optionalText(200),
  tags: z
    .array(tagName)
    .max(MAX_TAGS_PER_MEMORY, `Máximo ${MAX_TAGS_PER_MEMORY} etiquetas`)
    .default([])
    .transform((tags) => [...new Set(tags)]),
  /** Ids de media_objects ya subidos, en el orden en que se muestran (el primero es la portada). */
  photoIds: z
    .array(uuid)
    .max(MAX_PHOTOS_PER_MEMORY, `Máximo ${MAX_PHOTOS_PER_MEMORY} fotos`)
    .default([])
    .refine((ids) => new Set(ids).size === ids.length, "Hay fotos repetidas"),
  isHighlighted: z.boolean().default(false),
});

export type MemoryInput = z.infer<typeof memoryInputSchema>;

/** Creación: el cliente puede proponer el id (útil para el modo offline de la Fase 9). */
export const memoryCreateSchema = memoryInputSchema.extend({ id: uuid.optional() });

export const memoryListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(40).optional(),
  tag: z.string().trim().toLowerCase().max(40).optional(),
  favorites: z.enum(["1"]).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const favoriteSchema = z.object({ favorite: z.boolean() });

export const coverSchema = z.object({ mediaId: uuid.nullable() });
