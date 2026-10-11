import { describe, expect, it } from "vitest";
import type { ImportantDateRow } from "../repositories/importantDateRepository";
import { sortImportantDates, toImportantDate } from "./importantDateService";
import { buildTimeline } from "./usService";

const row = (patch: Partial<ImportantDateRow>): ImportantDateRow => ({
  id: "d1",
  title: "Fecha",
  date_type: "custom",
  event_date: "2026-01-15",
  recurs_yearly: 1,
  emoji: null,
  notes: null,
  ...patch,
});

describe("toImportantDate", () => {
  it("las fechas anuales calculan la próxima vez y los años", () => {
    const date = toImportantDate(row({ date_type: "birthday", event_date: "2000-05-03" }), "2026-10-11");
    expect(date).toMatchObject({ nextDate: "2027-05-03", daysUntil: 204, years: 27, emoji: "🎂" });
  });

  it("las fechas únicas ya pasadas no tienen próxima vez", () => {
    expect(toImportantDate(row({ recurs_yearly: 0, event_date: "2026-03-01" }), "2026-10-11")).toMatchObject({ nextDate: null, daysUntil: null });
    expect(toImportantDate(row({ recurs_yearly: 0, event_date: "2026-12-01" }), "2026-10-11")).toMatchObject({ nextDate: "2026-12-01", daysUntil: 51, years: null });
  });

  it("respeta el emoji elegido", () => {
    expect(toImportantDate(row({ emoji: "🌻" }), "2026-10-11").emoji).toBe("🌻");
  });

  it("ordena: próximas primero, pasadas al final", () => {
    const sorted = sortImportantDates([
      toImportantDate(row({ id: "pasada", recurs_yearly: 0, event_date: "2026-03-01" }), "2026-10-11"),
      toImportantDate(row({ id: "lejos", event_date: "2025-09-01" }), "2026-10-11"),
      toImportantDate(row({ id: "cerca", event_date: "2025-10-20" }), "2026-10-11"),
    ]);
    expect(sorted.map((d) => d.id)).toEqual(["cerca", "lejos", "pasada"]);
  });
});

describe("buildTimeline", () => {
  const base = { relationship: { startedOn: "2024-02-29", timezone: "America/Lima" }, today: "2026-10-11" };
  const cover = { cover_id: null, cover_width: null, cover_height: null };

  it("ordena el inicio, aniversarios, recuerdos, planes y fechas del más antiguo al más nuevo", () => {
    const events = buildTimeline({
      ...base,
      memories: [{ id: "m1", title: "Primera cita", happened_on: "2024-03-10", place_name: "Café", ...cover }],
      plans: [{ id: "p1", title: "Cusco", plan_type: "trip", planned_for: "2025-07-01", completed_at: "2025-07-03T15:00:00.000Z", place_name: null, ...cover }],
      dates: [
        row({ id: "d1", title: "Nos conocimos", date_type: "first_time", event_date: "2024-01-20" }),
        row({ id: "d2", title: "Cumple", date_type: "birthday", event_date: "2000-05-03" }),
        row({ id: "d3", title: "Mudanza", event_date: "2027-01-01", recurs_yearly: 0 }),
      ],
    });
    expect(events.map((e) => [e.date, e.title])).toEqual([
      ["2024-01-20", "Nos conocimos"],
      ["2024-02-29", "Empezamos"],
      ["2024-03-10", "Primera cita"],
      ["2025-02-28", "Nuestro primer aniversario"],
      ["2025-07-01", "Cusco"],
      ["2026-02-28", "2 años juntos"],
    ]);
    expect(events.find((e) => e.kind === "plan")).toMatchObject({ emoji: "✈️", link: "/planes/p1" });
  });

  it("un plan realizado antes de su fecha usa el día en que se hizo (zona de la pareja)", () => {
    const [, plan] = buildTimeline({
      ...base,
      memories: [],
      plans: [{ id: "p1", title: "Cine", plan_type: "movie", planned_for: "2026-12-01", completed_at: "2026-10-11T03:00:00.000Z", place_name: null, ...cover }],
      dates: [],
    }).filter((e) => e.kind !== "anniversary");
    expect(plan?.date).toBe("2026-10-10");
  });

  it("no incluye aniversarios futuros", () => {
    const events = buildTimeline({ relationship: { startedOn: "2026-02-01", timezone: "UTC" }, today: "2026-10-11", memories: [], plans: [], dates: [] });
    expect(events.map((e) => e.kind)).toEqual(["start"]);
  });
});
