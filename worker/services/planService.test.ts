import { describe, expect, it } from "vitest";
import type { PlanDetail } from "@shared/api";
import { MEMORY_CATEGORIES } from "@shared/schemas";
import { MEMORY_CATEGORY_FOR_PLAN, memoryFromPlan } from "./planService";

const plan: PlanDetail = {
  id: "p1",
  type: "trip",
  status: "done",
  title: "Cusco",
  plannedFor: "2026-09-20",
  budget: null,
  placeName: "Cusco",
  completedAt: "2026-09-22T10:00:00.000Z",
  cover: { id: "m1", width: 100, height: 100 },
  photoCount: 2,
  resultingMemoryId: null,
  createdAt: "2026-08-01T10:00:00.000Z",
  description: "Machu Picchu al amanecer",
  photos: [
    { id: "m1", width: 100, height: 100 },
    { id: "m2", width: 100, height: 100 },
  ],
  author: { id: "u1", displayName: "Fabrizio" },
  updatedAt: "2026-09-22T10:00:00.000Z",
};

describe("memoryFromPlan", () => {
  it("copia título, descripción, lugar y fotos en orden", () => {
    expect(memoryFromPlan(plan, "2026-10-11")).toEqual({
      title: "Cusco",
      description: "Machu Picchu al amanecer",
      happenedOn: "2026-09-20",
      category: "Viaje",
      placeName: "Cusco",
      tags: [],
      photoIds: ["m1", "m2"],
      isHighlighted: false,
    });
  });

  it("si el plan no tenía fecha o era futura, usa hoy", () => {
    expect(memoryFromPlan({ ...plan, plannedFor: null }, "2026-10-11").happenedOn).toBe("2026-10-11");
    expect(memoryFromPlan({ ...plan, plannedFor: "2026-12-01" }, "2026-10-11").happenedOn).toBe("2026-10-11");
  });

  it("todas las categorías existen entre las de recuerdos", () => {
    for (const category of Object.values(MEMORY_CATEGORY_FOR_PLAN)) {
      if (category) expect(MEMORY_CATEGORIES).toContain(category);
    }
  });
});
