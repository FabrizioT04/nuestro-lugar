import { describe, expect, it } from "vitest";
import { letterCreateSchema, letterInputSchema, memoryCreateSchema, relationshipSetupSchema } from "./schemas";

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
