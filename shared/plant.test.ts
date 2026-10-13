import { describe, expect, it } from "vitest";
import { daysToNextStage, flowerCount, MAX_FLOWERS, plantMood, plantStage } from "./plant";

describe("crecimiento de la plantita", () => {
  it("empieza como semilla y brota con el primer riego", () => {
    expect(plantStage(0).name).toBe("Bulbo");
    expect(plantStage(1).name).toBe("Brote");
    expect(daysToNextStage(1)).toBe(3);
  });

  it("tarda semanas en florecer, como una planta de verdad", () => {
    expect(plantStage(34).name).toBe("Con botón");
    expect(flowerCount(34)).toBe(0);
    expect(plantStage(35).name).toBe("Primer lirio");
    expect(flowerCount(35)).toBe(1);
    expect(plantStage(50).name).toBe("En flor");
    expect(daysToNextStage(50)).toBeNull();
  });

  it("ya en flor le salen más flores, con un tope", () => {
    expect(flowerCount(45)).toBe(2);
    expect(flowerCount(10_000)).toBe(MAX_FLOWERS);
  });

  it("con sed se pone triste pero no se muere", () => {
    expect(plantMood(null)).toBe("happy");
    expect(plantMood(1)).toBe("happy");
    expect(plantMood(2)).toBe("thirsty");
    expect(plantMood(30)).toBe("very_thirsty");
  });
});
