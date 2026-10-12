import { z } from "zod";
import { AMBIENCES, PLACE_CATEGORIES, PLACE_INTERACTIONS } from "./places";

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

// ---------------------------------------------------------------------------
// Cartas
// ---------------------------------------------------------------------------

/**
 * normal: se puede abrir ya · open_when: "Ábreme cuando…", se abre cuando la otra persona quiera
 * scheduled: bloqueada (pero visible) hasta la fecha · surprise: invisible para la otra persona hasta la fecha
 */
export const LETTER_TYPES = ["normal", "open_when", "scheduled", "surprise"] as const;
export type LetterType = (typeof LETTER_TYPES)[number];

export const letterTypeNeedsDate = (type: LetterType) => type === "scheduled" || type === "surprise";

export const MAX_LETTER_LENGTH = 20_000;

const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");

export const letterInputSchema = z
  .object({
    type: z.enum(LETTER_TYPES, "Tipo de carta inválido"),
    title: z.string().trim().min(1, "Ponle un título").max(200, "Máximo 200 caracteres"),
    body: z
      .string()
      .trim()
      .min(1, "La carta está vacía")
      .max(MAX_LETTER_LENGTH, `Máximo ${MAX_LETTER_LENGTH} caracteres`),
    /** Lo que completa "Ábreme cuando…" (solo para open_when). */
    openWhenLabel: optionalText(80),
    /** Fecha y hora de apertura en la zona horaria de la pareja (solo scheduled y surprise). */
    unlockOn: isoDate.nullable().optional().transform((value) => value ?? null),
    unlockTime: clockTime.default("00:00"),
  })
  .superRefine((value, ctx) => {
    if (value.type === "open_when" && !value.openWhenLabel) {
      ctx.addIssue({ code: "custom", path: ["openWhenLabel"], message: "Completa “Ábreme cuando…”" });
    }
    if (letterTypeNeedsDate(value.type) && !value.unlockOn) {
      ctx.addIssue({ code: "custom", path: ["unlockOn"], message: "Elige cuándo se podrá abrir" });
    }
  })
  // Los campos que no aplican al tipo se descartan en lugar de guardarse a medias.
  .transform((value) => ({
    ...value,
    openWhenLabel: value.type === "open_when" ? value.openWhenLabel : null,
    unlockOn: letterTypeNeedsDate(value.type) ? value.unlockOn : null,
  }));

export type LetterInput = z.infer<typeof letterInputSchema>;

export const letterCreateSchema = z.intersection(letterInputSchema, z.object({ id: uuid.optional() }));

export const letterListQuerySchema = z.object({
  box: z.enum(["received", "sent"]).default("received"),
});

// ---------------------------------------------------------------------------
// Planes
// ---------------------------------------------------------------------------

export const PLAN_TYPES = ["date", "restaurant", "trip", "activity", "movie", "goal", "place_to_visit", "other"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const PLAN_STATUSES = ["pending", "done", "cancelled"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const CURRENCIES = ["PEN", "USD", "EUR"] as const;

/** Presupuesto máximo aceptado (en la unidad de la moneda). */
const MAX_BUDGET = 10_000_000;

export const planInputSchema = z
  .object({
    type: z.enum(PLAN_TYPES, "Tipo de plan inválido"),
    title: z.string().trim().min(1, "Ponle un título").max(200, "Máximo 200 caracteres"),
    description: optionalText(5000),
    plannedFor: isoDate.nullable().optional().transform((value) => value ?? null),
    /** En la unidad de la moneda (120.50), con hasta dos decimales. */
    budget: z
      .number("El presupuesto debe ser un número")
      .min(0, "El presupuesto no puede ser negativo")
      .max(MAX_BUDGET, "Presupuesto demasiado alto")
      .refine((value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6, "Máximo dos decimales")
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    currency: z.enum(CURRENCIES, "Moneda inválida").nullable().optional().transform((value) => value ?? null),
    placeName: optionalText(200),
    /** Fotos de cómo fue (se suben con purpose=plan). */
    photoIds: z
      .array(uuid)
      .max(MAX_PHOTOS_PER_MEMORY, `Máximo ${MAX_PHOTOS_PER_MEMORY} fotos`)
      .default([])
      .refine((ids) => new Set(ids).size === ids.length, "Hay fotos repetidas"),
  })
  .superRefine((value, ctx) => {
    if (value.budget !== null && !value.currency) {
      ctx.addIssue({ code: "custom", path: ["currency"], message: "Elige la moneda del presupuesto" });
    }
  })
  .transform(({ budget, currency, ...rest }) => ({
    ...rest,
    budgetCents: budget === null ? null : Math.round(budget * 100),
    currency: budget === null ? null : currency,
  }));

export type PlanInput = z.infer<typeof planInputSchema>;

export const planCreateSchema = z.intersection(planInputSchema, z.object({ id: uuid.optional() }));

export const planStatusSchema = z.object({ status: z.enum(PLAN_STATUSES, "Estado inválido") });

// ---------------------------------------------------------------------------
// Fechas importantes
// ---------------------------------------------------------------------------

export const IMPORTANT_DATE_TYPES = ["anniversary", "birthday", "first_time", "trip", "custom"] as const;
export type ImportantDateType = (typeof IMPORTANT_DATE_TYPES)[number];

export const importantDateInputSchema = z.object({
  title: z.string().trim().min(1, "Ponle un nombre").max(120, "Máximo 120 caracteres"),
  type: z.enum(IMPORTANT_DATE_TYPES, "Tipo de fecha inválido"),
  eventDate: isoDate,
  recursYearly: z.boolean().default(true),
  /** Un emoji opcional (si no, se usa el del tipo). */
  emoji: z
    .string()
    .trim()
    .max(16, "Usa un solo emoji")
    .refine((value) => value === "" || /^\p{Extended_Pictographic}/u.test(value), "Usa un emoji")
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
  notes: optionalText(500),
});

export type ImportantDateInput = z.infer<typeof importantDateInputSchema>;
/** Lo que envía el formulario (antes de aplicar valores por defecto y transformaciones). */
export type ImportantDatePayload = z.input<typeof importantDateInputSchema>;

export const importantDateCreateSchema = importantDateInputSchema.extend({ id: uuid.optional() });

// ---------------------------------------------------------------------------
// Caja del futuro
// ---------------------------------------------------------------------------

export const CAPSULE_RECIPIENTS = ["partner", "both"] as const;
export type CapsuleRecipient = (typeof CAPSULE_RECIPIENTS)[number];

export const MAX_PHOTOS_PER_CAPSULE = 6;
export const MAX_CAPSULE_MESSAGE_LENGTH = 5_000;
export const MAX_CAPSULE_LETTER_LENGTH = 10_000;

export const capsuleInputSchema = z
  .object({
    recipient: z.enum(CAPSULE_RECIPIENTS, "Elige para quién es"),
    title: z.string().trim().min(1, "Ponle un título").max(200, "Máximo 200 caracteres"),
    message: optionalText(MAX_CAPSULE_MESSAGE_LENGTH),
    /** La "pequeña carta" que va dentro. */
    letter: optionalText(MAX_CAPSULE_LETTER_LENGTH),
    /** Fecha y hora de apertura en la zona horaria de la pareja. */
    unlockOn: isoDate,
    unlockTime: clockTime.default("00:00"),
    /** Fotos subidas con purpose=capsule, en orden. */
    photoIds: z
      .array(uuid)
      .max(MAX_PHOTOS_PER_CAPSULE, `Máximo ${MAX_PHOTOS_PER_CAPSULE} fotos`)
      .default([])
      .refine((ids) => new Set(ids).size === ids.length, "Hay fotos repetidas"),
    /** Audio subido con /media/audio. */
    audioId: uuid.nullable().optional().transform((value) => value ?? null),
  })
  .superRefine((value, ctx) => {
    if (!value.message && !value.letter && value.photoIds.length === 0 && !value.audioId) {
      ctx.addIssue({ code: "custom", path: ["message"], message: "Guarda algo dentro: un texto, una carta, una foto o un audio" });
    }
    if (value.audioId && value.photoIds.includes(value.audioId)) {
      ctx.addIssue({ code: "custom", path: ["audioId"], message: "Archivo repetido" });
    }
  });

export type CapsuleInput = z.infer<typeof capsuleInputSchema>;
/** Lo que envía el formulario (antes de aplicar valores por defecto). */
export type CapsulePayload = z.input<typeof capsuleInputSchema>;

export const capsuleCreateSchema = z.intersection(capsuleInputSchema, z.object({ id: uuid.optional() }));

// ---------------------------------------------------------------------------
// Lugares: "¿Qué hacemos hoy?"
// ---------------------------------------------------------------------------

export const DIETARY_OPTIONS = ["vegetariano", "vegano", "sin gluten"] as const;

const placeCategory = z.enum(PLACE_CATEGORIES, "Categoría inválida");
const ambience = z.enum(AMBIENCES, "Ambiente inválido");
const budgetLevel = z.number().int().min(1, "Presupuesto inválido").max(4, "Presupuesto inválido");
const distanceKm = z.number().min(0.5, "Mínimo 0,5 km").max(50, "Máximo 50 km");

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Lo que se pide al recomendador. El texto libre se interpreta en el Worker; los filtros mandan sobre el texto. */
export const placeSearchSchema = z.object({
  text: z.string().trim().max(300, "Máximo 300 caracteres").optional(),
  categories: z.array(placeCategory).max(4, "Elige hasta 4 tipos").optional(),
  budget: budgetLevel.nullable().optional(),
  maxDistanceKm: distanceKm.optional(),
  openNow: z.boolean().optional(),
  ambience: z.array(ambience).max(4).optional(),
  food: z.string().trim().max(60, "Máximo 60 caracteres").optional(),
  location: geoPointSchema,
});
export type PlaceSearchInput = z.infer<typeof placeSearchSchema>;

export const placeInteractionSchema = z.object({
  type: z.enum(PLACE_INTERACTIONS, "Interacción inválida"),
  /** true marca, false desmarca. Así repetir la misma acción (reintento) no cambia el resultado. */
  active: z.boolean(),
  /** Categoría propia del lugar (no es contenido de Google): sirve para aprender gustos. */
  category: placeCategory.nullable().optional(),
});
export type PlaceInteractionInput = z.infer<typeof placeInteractionSchema>;

export const placePreferencesSchema = z.object({
  maxDistanceKm: distanceKm.nullable(),
  budgetMax: budgetLevel.nullable(),
  likedCategories: z.array(placeCategory).max(PLACE_CATEGORIES.length),
  dislikedCategories: z.array(placeCategory).max(PLACE_CATEGORIES.length),
  ambience: z.array(ambience).max(AMBIENCES.length),
  dietary: z.array(z.enum(DIETARY_OPTIONS)).max(DIETARY_OPTIONS.length),
});
export type PlacePreferencesInput = z.infer<typeof placePreferencesSchema>;

/** Ubicación opcional para calcular distancias en "Guardados". */
export const originQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const geocodeQuerySchema = z.object({ q: z.string().trim().min(2, "Escribe una zona").max(120) });

/** Place ID de Google: letras, números, "_" y "-". */
export const GOOGLE_PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
