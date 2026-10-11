import { describe, expect, it } from "vitest";
import { daysBetween, elapsedParts, nextYearlyOccurrence, todayIn } from "./dates";

describe("todayIn", () => {
  it("usa la zona horaria, no la del servidor", () => {
    // 03:00 UTC del 11/10 todavía es 10/10 en Lima (UTC-5).
    const now = new Date("2026-10-11T03:00:00Z");
    expect(todayIn("America/Lima", now)).toBe("2026-10-10");
    expect(todayIn("Europe/Madrid", now)).toBe("2026-10-11");
  });
});

describe("daysBetween", () => {
  it("cuenta días de calendario", () => {
    expect(daysBetween("2026-02-01", "2026-10-11")).toBe(252);
    expect(daysBetween("2026-10-11", "2026-10-11")).toBe(0);
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2); // bisiesto
  });
});

describe("nextYearlyOccurrence", () => {
  it("devuelve este año si aún no pasó", () => {
    expect(nextYearlyOccurrence("2024-12-24", "2026-10-11")).toEqual({ date: "2026-12-24", years: 2 });
  });
  it("pasa al año siguiente si ya pasó", () => {
    expect(nextYearlyOccurrence("2024-02-01", "2026-10-11")).toEqual({ date: "2027-02-01", years: 3 });
  });
  it("hoy cuenta como la próxima vez", () => {
    expect(nextYearlyOccurrence("2025-10-11", "2026-10-11")).toEqual({ date: "2026-10-11", years: 1 });
  });
  it("nunca devuelve el año original", () => {
    expect(nextYearlyOccurrence("2026-02-01", "2026-10-11")).toEqual({ date: "2027-02-01", years: 1 });
    expect(nextYearlyOccurrence("2026-12-01", "2026-10-11")).toEqual({ date: "2027-12-01", years: 1 });
  });
  it("29 de febrero se celebra el 28 en años no bisiestos", () => {
    expect(nextYearlyOccurrence("2024-02-29", "2026-01-10")).toEqual({ date: "2026-02-28", years: 2 });
    expect(nextYearlyOccurrence("2024-02-29", "2027-03-01")).toEqual({ date: "2028-02-29", years: 4 });
  });
});

describe("elapsedParts", () => {
  it("descompone en años, meses y días", () => {
    expect(elapsedParts("2026-02-01", "2026-10-11")).toEqual({ years: 0, months: 8, days: 10 });
    expect(elapsedParts("2023-11-20", "2026-10-11")).toEqual({ years: 2, months: 10, days: 21 });
    expect(elapsedParts("2026-01-31", "2026-03-01")).toEqual({ years: 0, months: 1, days: 1 });
  });
});
