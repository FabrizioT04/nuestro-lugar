import { describe, expect, it } from "vitest";
import type { PlaceIntent, PlaceSummary } from "@shared/api";
import { EMPTY_PREFERENCES } from "../../repositories/placeRepository";
import { affinityFromCounts, formatDistance, rankPlaces, type CoupleContext } from "./recommender";

let n = 0;
function place(overrides: Partial<PlaceSummary> = {}): PlaceSummary {
  n += 1;
  return {
    id: `place_${String(n).padStart(8, "0")}`,
    name: `Lugar ${n}`,
    category: "cafe",
    address: null,
    location: { lat: 0, lng: 0 },
    distanceM: 1000,
    rating: 4.3,
    ratingCount: 100,
    priceLevel: 2,
    openNow: true,
    mapsUrl: null,
    ...overrides,
  };
}

const intent: PlaceIntent = {
  categories: ["cafe", "dessert"],
  budget: null,
  maxDistanceKm: 5,
  openNow: false,
  ambience: [],
  food: null,
  dietary: [],
};

const couple = (overrides: Partial<CoupleContext> = {}): CoupleContext => ({
  mine: EMPTY_PREFERENCES,
  partner: EMPTY_PREFERENCES,
  partnerName: "Zuleyka",
  statusByPlace: new Map(),
  affinity: {},
  ...overrides,
});

const ids = (items: { place: PlaceSummary }[]) => items.map((item) => item.place.id);

describe("rankPlaces", () => {
  it("devuelve como máximo 5", () => {
    const candidates = Array.from({ length: 12 }, (_, i) => place({ category: i % 2 ? "cafe" : "dessert" }));
    expect(rankPlaces(candidates, intent, couple(), { textMatched: false })).toHaveLength(5);
  });

  it("excluye lo que alguno marcó como no me interesa", () => {
    const hidden = place();
    const result = rankPlaces([hidden, place()], intent, couple({ statusByPlace: new Map([[hidden.id, { mine: [], partner: ["not_interested"] }]]) }), {
      textMatched: false,
    });
    expect(ids(result)).not.toContain(hidden.id);
  });

  it("con 'abierto ahora' excluye los cerrados pero no los que no tienen horario", () => {
    const closed = place({ openNow: false });
    const unknown = place({ openNow: null });
    const result = rankPlaces([closed, unknown], { ...intent, openNow: true }, couple(), { textMatched: false });
    expect(ids(result)).toEqual([unknown.id]);
  });

  it("prefiere cerca y bien valorado", () => {
    const far = place({ distanceM: 4800, rating: 4.3 });
    const near = place({ distanceM: 300, rating: 4.3 });
    const great = place({ distanceM: 1500, rating: 4.9, ratingCount: 2000 });
    const fewReviews = place({ distanceM: 1500, rating: 5, ratingCount: 2 });
    const result = ids(rankPlaces([far, fewReviews, near, great], { ...intent, categories: ["cafe"] }, couple(), { textMatched: false }));
    expect(result.indexOf(near.id)).toBeLessThan(result.indexOf(far.id));
    expect(result.indexOf(great.id)).toBeLessThan(result.indexOf(fewReviews.id));
  });

  it("descarta lo que queda demasiado lejos (búsqueda por texto)", () => {
    const tooFar = place({ distanceM: 9000 });
    expect(rankPlaces([tooFar], intent, couple(), { textMatched: true })).toEqual([]);
  });

  it("castiga lo que pasa del presupuesto", () => {
    const pricey = place({ priceLevel: 4, rating: 4.8, ratingCount: 500 });
    const cheap = place({ priceLevel: 1 });
    expect(ids(rankPlaces([pricey, cheap], { ...intent, budget: 1 }, couple(), { textMatched: false }))[0]).toBe(cheap.id);
  });

  it("los gustos de los dos y su historial suben una categoría; lo que no les gusta la baja", () => {
    const cafe = place({ category: "cafe" });
    const dessert = place({ category: "dessert" });
    const liked = couple({
      mine: { ...EMPTY_PREFERENCES, likedCategories: ["dessert"] },
      partner: { ...EMPTY_PREFERENCES, likedCategories: ["dessert"] },
    });
    const result = rankPlaces([cafe, dessert], intent, liked, { textMatched: false });
    expect(result[0]!.place.id).toBe(dessert.id);
    expect(result[0]!.reasons).toContain("A los dos les gusta: postres y helados");

    const disliked = couple({ partner: { ...EMPTY_PREFERENCES, dislikedCategories: ["dessert"] } });
    expect(rankPlaces([dessert, cafe], intent, disliked, { textMatched: false })[0]!.place.id).toBe(cafe.id);

    const history = couple({ affinity: { dessert: 0.9 } });
    const top = rankPlaces([cafe, dessert], intent, history, { textMatched: false })[0]!;
    expect(top.place.id).toBe(dessert.id);
    expect(top.reasons).toContain("Les suele encantar: postres y helados");
  });

  it("explica por qué: lo que marcó la pareja va primero", () => {
    const p = place({ distanceM: 400, rating: 4.7, ratingCount: 300 });
    const [item] = rankPlaces([p], intent, couple({ statusByPlace: new Map([[p.id, { mine: [], partner: ["interested"] }]]) }), {
      textMatched: false,
    });
    expect(item!.reasons[0]).toBe("A Zuleyka le interesa");
    expect(item!.reasons).toHaveLength(3);
    expect(item!.status).toEqual({ mine: [], partner: ["interested"] });
  });

  it("da variedad: máximo 2 por categoría si hay otras opciones", () => {
    const cafes = Array.from({ length: 5 }, () => place({ category: "cafe", rating: 4.8, ratingCount: 900 }));
    const desserts = Array.from({ length: 2 }, () => place({ category: "dessert", rating: 4.0 }));
    const parks = [place({ category: "park", rating: 4.0 })];
    const result = rankPlaces([...cafes, ...desserts, ...parks], { ...intent, categories: ["cafe", "dessert", "park"] }, couple(), { textMatched: false });
    expect(result.filter((item) => item.place.category === "cafe")).toHaveLength(2);
    expect(result).toHaveLength(5);
  });

  it("no repite lugares duplicados", () => {
    const p = place();
    expect(rankPlaces([p, p], intent, couple(), { textMatched: false })).toHaveLength(1);
  });

  it("acepta una señal semántica opcional (para embeddings en el futuro)", () => {
    const a = place();
    const b = place();
    const result = rankPlaces([a, b], intent, couple(), { textMatched: false, semanticScore: (p) => (p.id === b.id ? 10 : 0) });
    expect(result[0]!.place.id).toBe(b.id);
  });
});

describe("affinityFromCounts", () => {
  it("lo que les encantó sube y lo que no les interesa baja", () => {
    const affinity = affinityFromCounts([
      { category: "park", type: "loved", total: 3 },
      { category: "bar", type: "not_interested", total: 4 },
    ]);
    expect(affinity.park).toBeGreaterThan(0.8);
    expect(affinity.bar).toBeLessThan(-0.6);
  });
});

describe("formatDistance", () => {
  it("metros redondeados y km con coma", () => {
    expect(formatDistance(812)).toBe("A 800 m");
    expect(formatDistance(10)).toBe("A 50 m");
    expect(formatDistance(2345)).toBe("A 2,3 km");
  });
});
