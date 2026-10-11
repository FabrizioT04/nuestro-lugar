import { describe, expect, it } from "vitest";
import {
  capsuleCreateSchema,
  capsuleInputSchema,
  importantDateInputSchema,
  letterCreateSchema,
  letterInputSchema,
  memoryCreateSchema,
  planCreateSchema,
  planInputSchema,
  planStatusSchema,
  relationshipSetupSchema,
} from "./schemas";

const valid = { myName: "Fabrizio", partnerName: "Pareja", startedOn: "2024-02-14", timezone: "America/Lima" };

describe("relationshipSetupSchema", () => {
  it("acepta datos válidos y recorta espacios", () => {
    expect(relationshipSetupSchema.parse({ ...valid, myName: "  Fabrizio " }).myName).toBe("Fabrizio");
  });

  it.each([
    ["fecha futura", { startedOn: "2999-01-01" }],
    ["fecha mal formada", { startedOn: "14/02/2024" }],
    ["día inexistente", { startedOn: "2024-02-31" }],
    ["zona horaria inventada", { timezone: "Marte/Olympus" }],
    ["nombre vacío", { partnerName: "   " }],
  ])("rechaza %s", (_name, patch) => {
    expect(relationshipSetupSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe("memoryCreateSchema", () => {
  const base = { title: "Primera cita", happenedOn: "2026-02-01" };

  it("normaliza etiquetas y textos vacíos", () => {
    const parsed = memoryCreateSchema.parse({ ...base, tags: ["Playa", "playa", " Sol "], description: "  ", placeName: "" });
    expect(parsed.tags).toEqual(["playa", "sol"]);
    expect(parsed.description).toBeNull();
    expect(parsed.placeName).toBeNull();
    expect(parsed.photoIds).toEqual([]);
    expect(parsed.isHighlighted).toBe(false);
  });

  it.each([
    ["sin título", { title: "  " }],
    ["fecha futura", { happenedOn: "2999-01-01" }],
    ["foto con id inválido", { photoIds: ["../../etc/passwd"] }],
    ["fotos repetidas", { photoIds: ["8d1f3a52-4a63-4b2c-9a7e-1f0e8c1d2b3a", "8d1f3a52-4a63-4b2c-9a7e-1f0e8c1d2b3a"] }],
    ["etiqueta con coma", { tags: ["a,b"] }],
  ])("rechaza %s", (_name, patch) => {
    expect(memoryCreateSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });
});

describe("letterInputSchema", () => {
  const base = { title: "Para ti", body: "Te quiero" };

  it("una carta normal no guarda fecha ni etiqueta aunque se envíen", () => {
    const parsed = letterInputSchema.parse({ ...base, type: "normal", unlockOn: "2030-01-01", openWhenLabel: "x" });
    expect(parsed.unlockOn).toBeNull();
    expect(parsed.openWhenLabel).toBeNull();
    expect(parsed.unlockTime).toBe("00:00");
  });

  it("“Ábreme cuando…” exige completar la frase", () => {
    expect(letterInputSchema.safeParse({ ...base, type: "open_when" }).success).toBe(false);
    expect(letterInputSchema.parse({ ...base, type: "open_when", openWhenLabel: " estés triste " }).openWhenLabel).toBe("estés triste");
  });

  it("programada y sorpresa exigen fecha", () => {
    expect(letterInputSchema.safeParse({ ...base, type: "scheduled" }).success).toBe(false);
    expect(letterInputSchema.safeParse({ ...base, type: "surprise", unlockOn: "2027-02-30" }).success).toBe(false);
    expect(letterInputSchema.safeParse({ ...base, type: "surprise", unlockOn: "2027-02-01", unlockTime: "24:00" }).success).toBe(false);
    expect(letterInputSchema.parse({ ...base, type: "scheduled", unlockOn: "2027-02-01", unlockTime: "09:30" }).unlockOn).toBe("2027-02-01");
  });

  it("rechaza tipos desconocidos y cartas vacías", () => {
    expect(letterInputSchema.safeParse({ ...base, type: "secreta" }).success).toBe(false);
    expect(letterInputSchema.safeParse({ ...base, type: "normal", body: "   " }).success).toBe(false);
  });

  it("la creación acepta un id opcional", () => {
    const id = "6f1c2a7e-4b8d-4c3e-9a1f-2d3e4f5a6b7c";
    expect(letterCreateSchema.parse({ ...base, type: "normal", id })).toMatchObject({ id, type: "normal" });
    expect(letterCreateSchema.safeParse({ ...base, type: "normal", id: "nope" }).success).toBe(false);
  });
});

describe("planInputSchema", () => {
  const base = { type: "restaurant", title: "Probar ramen" };

  it("convierte el presupuesto a céntimos", () => {
    const parsed = planInputSchema.parse({ ...base, budget: 120.5, currency: "PEN" });
    expect(parsed).toMatchObject({ budgetCents: 12050, currency: "PEN", plannedFor: null, photoIds: [] });
    expect(planInputSchema.parse({ ...base, budget: 0.1 + 0.2, currency: "USD" }).budgetCents).toBe(30);
  });

  it("sin presupuesto no guarda moneda", () => {
    expect(planInputSchema.parse({ ...base, currency: "USD" })).toMatchObject({ budgetCents: null, currency: null });
  });

  it.each([
    ["presupuesto sin moneda", { budget: 50 }],
    ["presupuesto negativo", { budget: -1, currency: "PEN" }],
    ["tres decimales", { budget: 10.555, currency: "PEN" }],
    ["presupuesto como texto", { budget: "50", currency: "PEN" }],
    ["moneda desconocida", { budget: 5, currency: "BTC" }],
    ["tipo desconocido", { type: "fiesta" }],
    ["fecha inválida", { plannedFor: "2027-13-01" }],
  ])("rechaza %s", (_name, patch) => {
    expect(planInputSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });

  it("acepta fechas futuras y un id opcional al crear", () => {
    const id = "6f1c2a7e-4b8d-4c3e-9a1f-2d3e4f5a6b7c";
    expect(planCreateSchema.parse({ ...base, plannedFor: "2030-05-01", id })).toMatchObject({ id, plannedFor: "2030-05-01" });
  });

  it("solo acepta los tres estados", () => {
    expect(planStatusSchema.safeParse({ status: "done" }).success).toBe(true);
    expect(planStatusSchema.safeParse({ status: "archived" }).success).toBe(false);
  });
});

describe("importantDateInputSchema", () => {
  const base = { title: "Primer beso", type: "first_time", eventDate: "2025-12-24" };
  it("acepta un emoji o ninguno", () => {
    expect(importantDateInputSchema.parse({ ...base, emoji: "💋" })).toMatchObject({ emoji: "💋", recursYearly: true, notes: null });
    expect(importantDateInputSchema.parse({ ...base, emoji: "" }).emoji).toBeNull();
  });
  it.each([
    ["texto en lugar de emoji", { emoji: "hola" }],
    ["tipo desconocido", { type: "boda" }],
    ["fecha inválida", { eventDate: "2025-02-30" }],
    ["nombre vacío", { title: " " }],
  ])("rechaza %s", (_name, patch) => {
    expect(importantDateInputSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });
});

describe("capsuleInputSchema", () => {
  const capsule = { recipient: "partner", title: "Dentro de un año", message: "Hola, futuro", unlockOn: "2027-10-11" };
  const photo = "8b0a2c4e-1f3d-4a5b-9c6d-7e8f9a0b1c2d";

  it("acepta una cápsula con texto y aplica valores por defecto", () => {
    const parsed = capsuleInputSchema.parse(capsule);
    expect(parsed.unlockTime).toBe("00:00");
    expect(parsed.photoIds).toEqual([]);
    expect(parsed.audioId).toBeNull();
    expect(parsed.letter).toBeNull();
  });

  it("acepta una cápsula solo con una foto o solo con un audio", () => {
    expect(capsuleInputSchema.safeParse({ ...capsule, message: "", photoIds: [photo] }).success).toBe(true);
    expect(capsuleInputSchema.safeParse({ ...capsule, message: null, audioId: photo }).success).toBe(true);
  });

  it("exige guardar algo dentro", () => {
    const result = capsuleInputSchema.safeParse({ ...capsule, message: "   " });
    expect(result.success).toBe(false);
  });

  it.each([
    ["sin fecha", { unlockOn: undefined }],
    ["fecha imposible", { unlockOn: "2027-02-30" }],
    ["destinatario raro", { recipient: "someone-else" }],
    ["hora inválida", { unlockTime: "25:00" }],
    ["demasiadas fotos", { photoIds: Array.from({ length: 7 }, (_, i) => photo.replace(/.$/, String(i))) }],
    ["fotos repetidas", { photoIds: [photo, photo] }],
    ["el audio repetido como foto", { photoIds: [photo], audioId: photo }],
    ["id que no es uuid", { photoIds: ["../../otra-cosa"] }],
  ])("rechaza %s", (_, patch) => {
    expect(capsuleInputSchema.safeParse({ ...capsule, ...patch }).success).toBe(false);
  });

  it("la creación admite un id propuesto por el cliente", () => {
    expect(capsuleCreateSchema.safeParse({ ...capsule, id: photo }).success).toBe(true);
    expect(capsuleCreateSchema.safeParse({ ...capsule, id: "nope" }).success).toBe(false);
  });
});
