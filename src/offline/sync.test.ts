import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// La app corre en el navegador; aquí basta con un "window" que emita eventos y un navigator.onLine.
const fakeWindow = new EventTarget();
vi.stubGlobal("window", fakeWindow);
vi.stubGlobal("navigator", { onLine: true });

const api = vi.hoisted(() => ({
  memoriesCreate: vi.fn(),
  setFavorite: vi.fn(),
  plansCreate: vi.fn(),
  setStatus: vi.fn(),
  lettersCreate: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/services/api/memories", () => ({ memoriesApi: { create: api.memoriesCreate, setFavorite: api.setFavorite } }));
vi.mock("@/services/api/plans", () => ({ plansApi: { create: api.plansCreate, setStatus: api.setStatus } }));
vi.mock("@/services/api/letters", () => ({ lettersApi: { create: api.lettersCreate } }));
vi.mock("@/services/api/media", () => ({ mediaApi: { upload: api.upload } }));

const { ApiError } = await import("@/services/api/client");
const { db } = await import("./db");
const { bindOwner, clearOfflineData, readCache, writeCache } = await import("./cache");
const { listOutbox, retryAction, saveLocalPhoto } = await import("./outbox");
const { isTransient, onSynced, retryDelay, submitAction, syncNow } = await import("./sync");

const offline = () => new ApiError(0, "network_error", "Sin conexión con el servidor");
const memoryInput = (title = "Playa") => ({
  id: crypto.randomUUID(),
  title,
  happenedOn: "2026-10-01",
  placeName: null,
  category: null,
  tags: [],
  description: null,
  isHighlighted: false,
});

beforeEach(async () => {
  await clearOfflineData();
  (navigator as { onLine: boolean }).onLine = true;
});
afterEach(() => vi.resetAllMocks());

describe("reintentos", () => {
  it("espera cada vez más, hasta 5 minutos", () => {
    expect(retryDelay(1)).toBe(5_000);
    expect(retryDelay(2)).toBe(10_000);
    expect(retryDelay(3)).toBe(20_000);
    expect(retryDelay(20)).toBe(300_000);
  });

  it("solo reintenta sola si no hubo respuesta o el servidor falló", () => {
    expect(isTransient(offline())).toBe(true);
    expect(isTransient(new ApiError(401, "session_expired", "x"))).toBe(true);
    expect(isTransient(new ApiError(429, "rate_limited", "x"))).toBe(true);
    expect(isTransient(new ApiError(503, "internal_error", "x"))).toBe(true);
    expect(isTransient(new ApiError(400, "bad_request", "x"))).toBe(false);
    expect(isTransient(new ApiError(403, "forbidden", "x"))).toBe(false);
    expect(isTransient(new Error("otro"))).toBe(false);
  });
});

describe("submitAction", () => {
  it("con conexión guarda en el momento y no deja nada en la cola", async () => {
    api.lettersCreate.mockResolvedValue({ id: "l1" });
    const result = await submitAction("letter.create", { input: { id: "l1" } as never }, "Carta");
    expect(result).toEqual({ status: "saved", result: { id: "l1" } });
    expect(await listOutbox()).toHaveLength(0);
  });

  it("un error de validación vuelve al formulario (no se encola)", async () => {
    api.lettersCreate.mockRejectedValue(new ApiError(400, "bad_request", "Falta el título"));
    await expect(submitAction("letter.create", { input: { id: "l1" } as never }, "Carta")).rejects.toThrow("Falta el título");
    expect(await listOutbox()).toHaveLength(0);
  });

  it("sin conexión queda ⏳ pendiente y se envía al volver, con el mismo client_action_id", async () => {
    (navigator as { onLine: boolean }).onLine = false;
    const input = memoryInput();
    expect(await submitAction("memory.create", { input, photos: [] }, "Playa")).toEqual({ status: "queued" });
    const [queued] = await listOutbox();
    expect(queued).toMatchObject({ type: "memory.create", status: "pending", label: "Playa" });

    (navigator as { onLine: boolean }).onLine = true;
    api.memoriesCreate.mockResolvedValue({ id: input.id });
    const synced = vi.fn();
    const off = onSynced(synced);
    await syncNow();
    off();

    expect(api.memoriesCreate).toHaveBeenCalledWith({ ...input, photoIds: [] }, queued!.id);
    expect(await listOutbox()).toHaveLength(0);
    expect(synced).toHaveBeenCalledOnce();
  });

  it("si la red falla a mitad de camino, reintenta con el mismo id (el Worker no lo duplica)", async () => {
    api.setFavorite.mockRejectedValueOnce(offline()).mockResolvedValueOnce({ favorite: true });
    expect(await submitAction("memory.favorite", { memoryId: "m1", favorite: true }, "Favorito")).toEqual({ status: "queued" });
    await vi.waitFor(async () => expect(await listOutbox()).toHaveLength(0));
    const [firstId, secondId] = api.setFavorite.mock.calls.map((call) => call[2]);
    expect(firstId).toBeTruthy();
    expect(secondId).toBe(firstId);
  });
});

describe("cola", () => {
  async function queue(title: string) {
    (navigator as { onLine: boolean }).onLine = false;
    await submitAction("memory.create", { input: memoryInput(title), photos: [] }, title);
    (navigator as { onLine: boolean }).onLine = true;
  }

  it("un error del Worker la marca ⚠ y sigue con las demás; Reintentar la vuelve a ⏳", async () => {
    await queue("Uno");
    await queue("Dos");
    api.memoriesCreate.mockRejectedValueOnce(new ApiError(400, "bad_request", "Fecha inválida")).mockResolvedValueOnce({ id: "2" });
    await syncNow();

    const [failed, ...rest] = await listOutbox();
    expect(rest).toHaveLength(0);
    expect(failed).toMatchObject({ label: "Uno", status: "error", error: "Fecha inválida", attempts: 1 });

    await retryAction(failed!.id);
    expect((await listOutbox())[0]).toMatchObject({ status: "pending", error: null });
  });

  it("un fallo de red espera (backoff) y no adelanta las siguientes", async () => {
    await queue("Uno");
    await queue("Dos");
    api.memoriesCreate.mockRejectedValue(new ApiError(503, "internal_error", "Caído"));
    const before = Date.now();
    await syncNow();

    expect(api.memoriesCreate).toHaveBeenCalledOnce();
    const [first, second] = await listOutbox();
    expect(first).toMatchObject({ status: "pending", attempts: 1 });
    expect(first!.nextAttemptAt).toBeGreaterThanOrEqual(before + 5_000);
    expect(second).toMatchObject({ status: "pending", attempts: 0 });

    await syncNow(); // todavía en espera: no se vuelve a intentar
    expect(api.memoriesCreate).toHaveBeenCalledOnce();
  });

  it("sube las fotos guardadas sin conexión (sin duplicarlas) y luego las borra del dispositivo", async () => {
    const blob = new Blob(["foto"], { type: "image/jpeg" });
    const localId = await saveLocalPhoto({ full: blob, thumb: blob, width: 10, height: 10 });
    (navigator as { onLine: boolean }).onLine = false;
    const input = memoryInput();
    await submitAction("memory.create", { input, photos: [{ mediaId: "ya-subida" }, { localPhotoId: localId }] }, "Con fotos");
    (navigator as { onLine: boolean }).onLine = true;

    // Primer intento: la foto se sube pero el recuerdo falla por red.
    api.upload.mockResolvedValue({ id: "subida-1" });
    api.memoriesCreate.mockRejectedValueOnce(offline());
    await syncNow();
    expect(api.upload).toHaveBeenCalledWith(expect.objectContaining({ id: localId }), "memory", localId);
    expect(await db.photos.get(localId)).toBeUndefined();
    expect((await listOutbox())[0]!.payload).toMatchObject({ photos: [{ mediaId: "ya-subida" }, { mediaId: "subida-1" }] });

    // Segundo intento: ya no vuelve a subir la foto.
    await db.outbox.toCollection().modify({ nextAttemptAt: 0 });
    api.memoriesCreate.mockResolvedValueOnce({ id: input.id });
    await syncNow();
    expect(api.upload).toHaveBeenCalledOnce();
    expect(api.memoriesCreate).toHaveBeenLastCalledWith({ ...input, photoIds: ["ya-subida", "subida-1"] }, expect.any(String));
    expect(await listOutbox()).toHaveLength(0);
  });
});

describe("datos del dispositivo", () => {
  it("si entra otra persona en el mismo navegador, se borra lo anterior", async () => {
    await bindOwner("fabrizio");
    await writeCache("home", { secreto: true });
    await bindOwner("fabrizio");
    expect(await readCache("home")).not.toBeNull();
    await bindOwner("otra");
    expect(await readCache("home")).toBeNull();
  });
});
