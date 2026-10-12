import { describe, expect, it } from "vitest";
import { parseIntentText, resolveIntent } from "./intent";

const defaults = { categories: ["cafe" as const, "park" as const], budget: null, maxDistanceKm: null, dietary: [] };

describe("parseIntentText", () => {
  it("entiende el ejemplo del pedido", () => {
    const intent = parseIntentText("Quiero un lugar tranquilo para comer algo dulce y conversar");
    expect(intent.categories).toEqual(["dessert"]);
    expect(intent.ambience).toEqual(["tranquilo"]);
    expect(intent.food).toBeNull();
  });

  it("comer a secas es un restaurante", () => {
    expect(parseIntentText("tenemos hambre, algo para comer").categories).toEqual(["restaurant"]);
  });

  it("ignora tildes y mayúsculas", () => {
    expect(parseIntentText("Un CAFÉ romántico").categories).toEqual(["cafe"]);
    expect(parseIntentText("Un CAFÉ romántico").ambience).toEqual(["romántico"]);
  });

  it("detecta comida concreta, presupuesto, cercanía y horario", () => {
    const intent = parseIntentText("Sushi barato cerca, ahorita");
    expect(intent.food).toBe("sushi");
    expect(intent.categories).toContain("restaurant");
    expect(intent.budget).toBe(1);
    expect(intent.maxDistanceKm).toBe(3);
    expect(intent.openNow).toBe(true);
  });

  it("detecta restricciones alimentarias y planes al aire libre", () => {
    const intent = parseIntentText("algo vegano y después pasear por un parque al aire libre");
    expect(intent.dietary).toEqual(["vegano"]);
    expect(intent.categories).toContain("park");
    expect(intent.ambience).toContain("aire libre");
  });

  it("no inventa nada con un texto sin pistas", () => {
    expect(parseIntentText("hola")).toEqual({
      categories: [],
      budget: null,
      maxDistanceKm: null,
      openNow: false,
      ambience: [],
      food: null,
      dietary: [],
    });
  });
});

describe("resolveIntent", () => {
  it("los filtros elegidos mandan sobre el texto", () => {
    const intent = resolveIntent({ text: "pizza barata cerca", categories: ["bar"], budget: 3, maxDistanceKm: 10 }, defaults);
    expect(intent.categories).toEqual(["bar"]);
    expect(intent.budget).toBe(3);
    expect(intent.maxDistanceKm).toBe(10);
    expect(intent.food).toBe("pizza");
  });

  it("budget null explícito significa sin presupuesto", () => {
    expect(resolveIntent({ text: "algo barato", budget: null }, defaults).budget).toBeNull();
  });

  it("sin texto ni filtros usa las preferencias y 5 km", () => {
    const intent = resolveIntent({}, { ...defaults, dietary: ["sin gluten"] });
    expect(intent.categories).toEqual(["cafe", "park"]);
    expect(intent.maxDistanceKm).toBe(5);
    expect(intent.dietary).toEqual(["sin gluten"]);
    expect(intent.openNow).toBe(false);
  });
});
