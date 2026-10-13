import { describe, expect, it } from "vitest";
import { countUpValue, easeOutCubic, heartSpecs, seededRandom } from "./motion";

describe("countUpValue", () => {
  it("empieza en 0 y termina exactamente en el número real", () => {
    expect(countUpValue(1336, 0, 1000)).toBe(0);
    expect(countUpValue(1336, 1000, 1000)).toBe(1336);
    expect(countUpValue(1336, 5000, 1000)).toBe(1336);
  });

  it("sube siempre (nunca retrocede) y va más rápido al principio", () => {
    const values = Array.from({ length: 11 }, (_, i) => countUpValue(1000, i * 100, 1000));
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]!);
    expect(values[5]).toBeGreaterThan(500);
  });

  it("sin duración muestra el número directo", () => {
    expect(countUpValue(42, 0, 0)).toBe(42);
  });
});

describe("easeOutCubic", () => {
  it("se mantiene entre 0 y 1", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe("heartSpecs", () => {
  it("con la misma semilla da los mismos corazones", () => {
    expect(heartSpecs(8, 7)).toEqual(heartSpecs(8, 7));
    expect(heartSpecs(8, 7)).not.toEqual(heartSpecs(8, 8));
  });

  it("respeta los rangos", () => {
    for (const heart of heartSpecs(50, 3, { minSize: 10, maxSize: 20, maxDelay: 1 })) {
      expect(heart.left).toBeGreaterThanOrEqual(0);
      expect(heart.left).toBeLessThanOrEqual(100);
      expect(heart.size).toBeGreaterThanOrEqual(10);
      expect(heart.size).toBeLessThanOrEqual(20);
      expect(heart.delay).toBeLessThanOrEqual(1);
      expect(heart.color).toMatch(/^#/);
    }
  });

  it("el generador da números entre 0 y 1", () => {
    const random = seededRandom(0);
    for (let i = 0; i < 100; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
