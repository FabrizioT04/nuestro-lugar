import { describe, expect, it } from "vitest";
import { memoryCreateSchema, relationshipSetupSchema } from "./schemas";

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
