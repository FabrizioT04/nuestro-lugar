import { describe, expect, it } from "vitest";
import { growthText, moodText } from "./PlantPage";

describe("textos de la plantita", () => {
  it("dice cuánto falta para crecer, en singular o plural", () => {
    expect(growthText({ careDays: 0, daysToNextStage: 1, flowers: 0 })).toBe("0 días de cuidado · le falta 1 día para crecer más");
    expect(growthText({ careDays: 5, daysToNextStage: 5, flowers: 0 })).toBe("5 días de cuidado · le faltan 5 días para crecer más");
    expect(growthText({ careDays: 60, daysToNextStage: null, flowers: 2 })).toBe("60 días de cuidado · 2 flores");
  });

  it("cuenta cómo está", () => {
    expect(moodText({ careDays: 0, mood: "happy", daysSinceWater: null })).toContain("Recién sembrada");
    expect(moodText({ careDays: 8, mood: "very_thirsty", daysSinceWater: 4 })).toBe("Tiene mucha sed: lleva 4 días sin agua");
    expect(moodText({ careDays: 8, mood: "happy", daysSinceWater: 0 })).toBe("Está feliz");
  });
});
