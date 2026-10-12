import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../utils/errors";
import { categoryFromTypes, createPlacesClient, distanceMeters, GOOGLE_TYPES } from "./googlePlaces";

const origin = { lat: -12.1211, lng: -77.0297 }; // Miraflores

const googlePlace = {
  id: "ChIJ_abcdefghijk",
  displayName: { text: "Heladería La Lucha" },
  shortFormattedAddress: "Av. Larco 123, Miraflores",
  location: { latitude: -12.1225, longitude: -77.0301 },
  types: ["ice_cream_shop", "food", "point_of_interest"],
  primaryType: "ice_cream_shop",
  rating: 4.6,
  userRatingCount: 812,
  priceLevel: "PRICE_LEVEL_INEXPENSIVE",
  currentOpeningHours: { openNow: true },
  googleMapsUri: "https://maps.google.com/?cid=1",
};

function mockFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );
}

describe("createPlacesClient", () => {
  it("sin clave responde 503 sin llamar a Google", async () => {
    const fetcher = mockFetch(200, {});
    const client = createPlacesClient(undefined, fetcher as typeof fetch);
    await expect(client.searchNearby({ location: origin, radiusM: 5000, categories: ["cafe"] })).rejects.toMatchObject({
      status: 503,
      code: "service_unavailable",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("searchNearby pide solo los campos necesarios y traduce la respuesta", async () => {
    const fetcher = mockFetch(200, { places: [googlePlace, { id: "sin-nombre" }] });
    const client = createPlacesClient("clave-de-prueba", fetcher as typeof fetch);
    const places = await client.searchNearby({ location: origin, radiusM: 80000, categories: ["dessert", "cafe"] });

    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://places.googleapis.com/v1/places:searchNearby");
    const headers = init!.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("clave-de-prueba");
    expect(headers["x-goog-fieldmask"]).toContain("places.id");
    expect(headers["x-goog-fieldmask"]).not.toContain("photos");
    expect(headers["x-goog-fieldmask"]).not.toContain("reviews");
    const body = JSON.parse(init!.body as string);
    expect(body.includedTypes).toEqual([...GOOGLE_TYPES.dessert, ...GOOGLE_TYPES.cafe]);
    expect(body.locationRestriction.circle.radius).toBe(50000); // tope de Google
    expect(body.languageCode).toBe("es");

    expect(places).toEqual([
      {
        id: "ChIJ_abcdefghijk",
        name: "Heladería La Lucha",
        category: "dessert",
        address: "Av. Larco 123, Miraflores",
        location: { lat: -12.1225, lng: -77.0301 },
        distanceM: distanceMeters(origin, { lat: -12.1225, lng: -77.0301 }),
        rating: 4.6,
        ratingCount: 812,
        priceLevel: 1,
        openNow: true,
        mapsUrl: "https://maps.google.com/?cid=1",
      },
    ]);
  });

  it("searchText manda abierto ahora y los niveles de precio hasta el presupuesto", async () => {
    const fetcher = mockFetch(200, { places: [] });
    const client = createPlacesClient("k", fetcher as typeof fetch);
    await client.searchText({ text: "sushi", location: origin, radiusM: 3000, openNow: true, budget: 2 });
    const body = JSON.parse(fetcher.mock.calls[0]![1]!.body as string);
    expect(body).toMatchObject({ textQuery: "sushi", openNow: true, priceLevels: ["PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE"] });
  });

  it("descarta lugares cerrados definitivamente", async () => {
    const client = createPlacesClient("k", mockFetch(200, { places: [{ ...googlePlace, businessStatus: "CLOSED_PERMANENTLY" }] }) as typeof fetch);
    expect(await client.searchNearby({ location: origin, radiusM: 1000, categories: ["dessert"] })).toEqual([]);
  });

  it.each([
    [429, "rate_limited"],
    [403, "service_unavailable"],
    [500, "upstream_error"],
  ])("Google %i → %s, sin filtrar el detalle de Google", async (status, code) => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const client = createPlacesClient("k", mockFetch(status, "detalle interno del proyecto") as typeof fetch);
    const error = await client.searchNearby({ location: origin, radiusM: 1000, categories: ["cafe"] }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code });
    expect((error as Error).message).not.toContain("detalle interno");
  });

  it("clave inválida (400 API_KEY_INVALID) → no configurado", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const client = createPlacesClient("k", mockFetch(400, { error: { status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } }) as typeof fetch);
    await expect(client.geocode("Barranco")).rejects.toMatchObject({ code: "service_unavailable" });
  });

  it("sin conexión con Google → 502", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("network");
    });
    const client = createPlacesClient("k", fetcher as unknown as typeof fetch);
    await expect(client.geocode("Barranco")).rejects.toMatchObject({ status: 502, code: "upstream_error" });
  });

  it("details de un lugar que ya no existe → null", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const client = createPlacesClient("k", mockFetch(404, "") as typeof fetch);
    expect(await client.details("ChIJ_abcdefghijk", origin)).toBeNull();
  });
});

describe("categoryFromTypes", () => {
  it("el tipo principal manda; los restaurantes específicos son restaurante", () => {
    expect(categoryFromTypes("cafe", ["restaurant"])).toBe("cafe");
    expect(categoryFromTypes("sushi_restaurant", ["food"])).toBe("restaurant");
    expect(categoryFromTypes(undefined, ["point_of_interest", "park"])).toBe("park");
    expect(categoryFromTypes("gas_station", [])).toBeNull();
  });
});
