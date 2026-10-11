import { describe, expect, it } from "vitest";
import { relationshipSetupSchema } from "./schemas";

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
