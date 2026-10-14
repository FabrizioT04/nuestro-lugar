import { afterEach, describe, expect, it, vi } from "vitest";
import { HAPTICS, isNightAt, vibrate } from "./haptics";

afterEach(() => vi.unstubAllGlobals());

describe("vibración", () => {
  it("vibra con el patrón pedido cuando el teléfono lo permite", () => {
    const spy = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: spy });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    expect(vibrate(HAPTICS.like)).toBe(true);
    expect(spy).toHaveBeenCalledWith(HAPTICS.like);
  });

  it("no hace nada si no hay vibración (iPhone) o se pidió reducir movimiento", () => {
    vi.stubGlobal("navigator", {});
    expect(vibrate(HAPTICS.tap)).toBe(false);
    const spy = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: spy });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    expect(vibrate(HAPTICS.tap)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("noche en la zona horaria de la pareja", () => {
  it.each([["19:00", true], ["23:59", true], ["03:10", true], ["05:59", true], ["06:00", false], ["12:30", false], ["18:59", false]])("%s → %s", (time, night) => {
    expect(isNightAt(time)).toBe(night);
  });
});
