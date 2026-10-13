import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createMemoryRepository } from "../repositories/memoryRepository";
import { createFakeD1 } from "../testing/fakeD1";
import type { MemoryAi } from "./memoryAi/ai";
import { parseQuestion, memoryText, spanishDate } from "./memoryAi/question";
import { orderedAnswer, rankMatches, searchMemories } from "./memorySearchService";

// IA de mentira: el "vector" cuenta palabras de un vocabulario pequeño (suficiente para probar el flujo).
const VOCAB = ["playa", "mar", "pizza", "comer", "viaje", "cusco", "cine", "pelicula"];
function fakeAi() {
  const store = new Map<string, { values: number[]; relationshipId: string }>();
  const embed = (text: string) => {
    const lower = text.toLowerCase();
    return VOCAB.map((word) => (lower.includes(word) ? 1 : 0));
  };
  const cosine = (a: number[], b: number[]) => {
    const dot = a.reduce((sum, value, i) => sum + value * b[i]!, 0);
    const norm = Math.sqrt(a.reduce((s, v) => s + v * v, 0)) * Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    return norm === 0 ? 0 : dot / norm;
  };
  const ai = {
    store,
    embed: vi.fn(async (texts: string[]) => texts.map(embed)),
    answer: vi.fn(async () => "Fueron a comer pizza a Barranco."),
    upsert: vi.fn(async (vectors: { id: string; values: number[]; relationshipId: string }[]) => {
      for (const v of vectors) store.set(v.id, { values: v.values, relationshipId: v.relationshipId });
    }),
    remove: vi.fn(async (ids: string[]) => ids.forEach((id) => store.delete(id))),
    query: vi.fn(async (vector: number[], relationshipId: string, topK: number) =>
      [...store.entries()]
        .filter(([, v]) => v.relationshipId === relationshipId)
        .map(([id, v]) => ({ id, score: cosine(vector, v.values) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK),
    ),
  };
  return ai satisfies MemoryAi;
}

const user: AuthenticatedUser = { id: "u1", email: "a@x.com", displayName: "A", introSeenAt: null, relationshipId: "r1" };
const other: AuthenticatedUser = { id: "u3", email: "c@x.com", displayName: "C", introSeenAt: null, relationshipId: "r2" };

let env: Bindings;
async function addMemory(id: string, title: string, happenedOn: string, extra: { placeName?: string; description?: string; relationshipId?: string } = {}) {
  await createMemoryRepository(env.DB).create(id, extra.relationshipId ?? "r1", extra.relationshipId === "r2" ? "u3" : "u1", {
    title,
    description: extra.description ?? null,
    happenedOn,
    category: null,
    placeName: extra.placeName ?? null,
    tags: [],
    photoIds: [],
    isHighlighted: false,
  });
}

beforeEach(async () => {
  env = { DB: createFakeD1() } as unknown as Bindings;
  await env.DB.exec(`INSERT INTO users (id, email, display_name) VALUES ('u1','a@x.com','A'), ('u2','b@x.com','B'), ('u3','c@x.com','C')`);
  await env.DB.exec(`INSERT INTO relationships (id, started_on) VALUES ('r1','2024-01-01'), ('r2','2024-01-01')`);
  await addMemory("m-playa-1", "Primer día de playa", "2024-02-10", { placeName: "Punta Hermosa", description: "El mar estaba helado" });
  await addMemory("m-playa-2", "Atardecer en la playa", "2025-01-20", { placeName: "Asia" });
  await addMemory("m-pizza", "Noche de pizza", "2024-06-01", { placeName: "Barranco", description: "Fuimos a comer pizza" });
  await addMemory("m-cusco", "Viaje a Cusco", "2024-09-15");
  await addMemory("m-otra", "Playa de otra pareja", "2023-01-01", { relationshipId: "r2" });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("searchMemories", () => {
  it("indexa lo pendiente y responde 'la primera vez' con los datos, sin inventar", async () => {
    const ai = fakeAi();
    const result = await searchMemories(env, user, "¿Cuándo fuimos por primera vez a la playa?", { ai });
    expect(result.mode).toBe("ai");
    expect(result.pendingIndex).toBe(0);
    expect(result.items.map((item) => item.id)).toEqual(["m-playa-1", "m-playa-2"]);
    expect(result.answer).toBe("La primera vez fue el 10 de febrero de 2024 en Punta Hermosa: «Primer día de playa».");
    expect(ai.answer).not.toHaveBeenCalled();
    // Solo se indexan los recuerdos de esta pareja.
    expect([...ai.store.keys()].sort()).toEqual(["m-cusco", "m-pizza", "m-playa-1", "m-playa-2"]);
  });

  it("no vuelve a indexar lo que no cambió; sí lo editado y quita lo borrado", async () => {
    const ai = fakeAi();
    await searchMemories(env, user, "playa", { ai });
    ai.embed.mockClear();
    await searchMemories(env, user, "playa", { ai });
    expect(ai.embed).toHaveBeenCalledTimes(1); // solo la pregunta

    await env.DB.exec(`UPDATE memories SET title = 'Viaje a Cusco y Machu Picchu', updated_at = '2099-01-01T00:00:00.000Z' WHERE id = 'm-cusco'`);
    await createMemoryRepository(env.DB).softDelete("r1", "m-playa-2");
    ai.embed.mockClear();
    const result = await searchMemories(env, user, "playa", { ai });
    expect(ai.embed.mock.calls[0]![0]).toHaveLength(1); // re-indexa solo el editado
    expect(ai.remove).toHaveBeenCalledWith(["m-playa-2"]);
    expect(result.items.map((item) => item.id)).toEqual(["m-playa-1"]);
  });

  it("con pregunta abierta, la IA responde solo con los recuerdos encontrados", async () => {
    const ai = fakeAi();
    const result = await searchMemories(env, user, "Muéstrame cuando fuimos a comer pizza", { ai });
    expect(result.items[0]!.id).toBe("m-pizza");
    expect(result.answer).toBe("Fueron a comer pizza a Barranco.");
    const [, prompt] = ai.answer.mock.calls[0] as unknown as [string, string];
    expect(prompt).toContain("«Noche de pizza»");
    expect(prompt).toContain("1 de junio de 2024");
    expect(prompt).not.toContain("otra pareja");
  });

  it("si la IA falla, busca por palabras y lo dice", async () => {
    const ai = fakeAi();
    ai.embed.mockRejectedValue(new Error("cupo agotado"));
    const result = await searchMemories(env, user, "cuando fuimos a la playa", { ai });
    expect(result.mode).toBe("keywords");
    expect(result.pendingIndex).toBe(4);
    expect(result.items.map((item) => item.id).sort()).toEqual(["m-playa-1", "m-playa-2"]);
  });

  it("sin IA configurada también funciona (por palabras)", async () => {
    const result = await searchMemories(env, user, "Cusco", { ai: null });
    expect(result).toMatchObject({ mode: "keywords", items: [{ id: "m-cusco" }] });
  });

  it("nunca devuelve recuerdos de otra pareja", async () => {
    const ai = fakeAi();
    await searchMemories(env, other, "playa", { ai }); // indexa los de r2
    const result = await searchMemories(env, user, "playa otra pareja", { ai });
    expect(result.items.map((item) => item.id)).not.toContain("m-otra");
  });

  it("filtra por año y responde cuando no hay nada", async () => {
    const ai = fakeAi();
    const result = await searchMemories(env, user, "playa en 2025", { ai });
    expect(result.items.map((item) => item.id)).toEqual(["m-playa-2"]);
    const none = await searchMemories(env, user, "cine", { ai });
    expect(none).toMatchObject({ items: [], answer: "No encontramos recuerdos sobre eso." });
  });
});

describe("parseQuestion", () => {
  it("entiende primera/última vez, año y palabras clave", () => {
    expect(parseQuestion("¿Cuándo fuimos por primera vez a la playa?")).toEqual({ order: "first", year: null, terms: ["playa"] });
    expect(parseQuestion("La última vez que comimos sushi en 2024")).toMatchObject({ order: "last", year: 2024, terms: ["comimos", "sushi"] });
    expect(parseQuestion("Quiero recordar algún viaje bonito").terms).toEqual(["viaje"]);
  });
});

describe("rankMatches", () => {
  it("se queda con lo cercano al mejor y suma las coincidencias por palabras", () => {
    const ids = rankMatches(
      [
        { id: "a", score: 0.82 },
        { id: "b", score: 0.75 },
        { id: "c", score: 0.5 },
      ],
      [{ id: "c", happened_on: "2024-01-01", hits: 2 }, { id: "d", happened_on: "2024-01-01", hits: 1 }],
    );
    expect(ids).toEqual(["a", "b", "c", "d"]);
  });

  it("descarta resultados por significado demasiado lejanos", () => {
    expect(rankMatches([{ id: "a", score: 0.3 }], [])).toEqual([]);
  });
});

describe("textos", () => {
  it("fecha en español y texto del recuerdo", () => {
    expect(spanishDate("2025-10-12")).toBe("12 de octubre de 2025");
    expect(memoryText({ title: "Cusco", description: "Machu Picchu", happened_on: "2024-09-15", category: "Viaje", place_name: null, tags: ["sierra"] })).toBe(
      "Recuerdo: Cusco. Fecha: 15 de septiembre de 2024. Categoría: Viaje. Etiquetas: sierra. Machu Picchu",
    );
  });

  it("orderedAnswer sin lugar", () => {
    expect(orderedAnswer("last", [{ id: "x", title: "Cine", happenedOn: "2025-03-01", placeName: null } as never])).toBe(
      "La última vez fue el 1 de marzo de 2025: «Cine».",
    );
  });
});
