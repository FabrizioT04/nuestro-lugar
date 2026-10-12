import { ApiError } from "@/services/api/client";
import { lettersApi } from "@/services/api/letters";
import { mediaApi } from "@/services/api/media";
import { memoriesApi } from "@/services/api/memories";
import { plansApi } from "@/services/api/plans";
import { db } from "./db";
import { enqueue, getLocalPhoto, listOutbox, notifyOutbox, removeAction, updateAction } from "./outbox";
import type { ActionPayloads, ActionType, OutboxAction, PhotoSlot } from "./types";

// Envía la cola al Worker, en orden, una acción a la vez:
//   ⏳ pendiente → enviando → ✓ (se borra de la cola) o ⚠ error.
// Cada acción viaja con su client_action_id: si la conexión se corta después de que el Worker
// la aplicó, el reintento recibe la misma respuesta y no se duplica nada.

/** Espera entre reintentos tras fallos de red o del servidor: 5 s, 10 s, 20 s… hasta 5 min. */
export function retryDelay(attempts: number): number {
  return Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 5 * 60_000);
}

/**
 * ¿Merece la pena reintentar sola? Sí si no hubo respuesta, el servidor falló o pidió esperar.
 * No si el Worker rechazó la acción (datos inválidos, permisos, ya no existe): eso lo decide la persona.
 */
export function isTransient(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return err.code === "network_error" || err.code === "session_expired" || err.status === 429 || err.status >= 500;
}

/** Sube las fotos que quedaron en el dispositivo y guarda en la acción el id que les dio el Worker. */
async function uploadLocalPhotos(action: OutboxAction<"memory.create" | "plan.create">, purpose: "memory" | "plan"): Promise<string[]> {
  const slots: PhotoSlot[] = [...action.payload.photos];
  for (const [index, slot] of slots.entries()) {
    if (!("localPhotoId" in slot)) continue;
    const photo = await getLocalPhoto(slot.localPhotoId);
    if (!photo) {
      slots[index] = { mediaId: "" };
      continue;
    }
    // El id de la foto local sirve de client_action_id: reintentar la subida no la duplica.
    const uploaded = await mediaApi.upload(photo, purpose, photo.id);
    slots[index] = { mediaId: uploaded.id };
    await db.transaction("rw", db.outbox, db.photos, async () => {
      await db.outbox.update(action.id, { payload: { ...action.payload, photos: [...slots] } });
      await db.photos.delete(photo.id);
    });
  }
  return slots.flatMap((slot) => ("mediaId" in slot && slot.mediaId ? [slot.mediaId] : []));
}

type Executors = { [T in ActionType]: (action: OutboxAction<T>) => Promise<unknown> };

const executors: Executors = {
  "memory.create": async (action) => {
    const photoIds = await uploadLocalPhotos(action, "memory");
    return memoriesApi.create({ ...action.payload.input, photoIds }, action.id);
  },
  "memory.favorite": (action) => memoriesApi.setFavorite(action.payload.memoryId, action.payload.favorite, action.id),
  "plan.create": async (action) => {
    const photoIds = await uploadLocalPhotos(action, "plan");
    return plansApi.create({ ...action.payload.input, photoIds }, action.id);
  },
  "plan.status": (action) => plansApi.setStatus(action.payload.planId, action.payload.status, action.id),
  "letter.create": (action) => lettersApi.create(action.payload.input, action.id),
};

function execute(action: OutboxAction): Promise<unknown> {
  const run = executors[action.type] as (action: OutboxAction) => Promise<unknown>;
  return run(action);
}

// ---------------------------------------------------------------------------
// Avisos de sincronización (para que las pantallas recarguen sus datos)
// ---------------------------------------------------------------------------

const SYNCED_EVENT = "nl:synced";

export function onSynced(listener: () => void): () => void {
  window.addEventListener(SYNCED_EVENT, listener);
  return () => window.removeEventListener(SYNCED_EVENT, listener);
}

// ---------------------------------------------------------------------------
// Vaciar la cola
// ---------------------------------------------------------------------------

let running: Promise<void> | null = null;

/** Envía todo lo pendiente. Si ya se está enviando, espera a que termine esa misma pasada. */
export function syncNow(): Promise<void> {
  running ??= drain().finally(() => {
    running = null;
  });
  return running;
}

async function drain(): Promise<void> {
  if (!navigator.onLine) return;
  let applied = 0;
  for (const action of await listOutbox()) {
    if (action.status === "error") continue;
    if (action.nextAttemptAt > Date.now()) break; // respeta el orden: lo que viene después puede depender de esta
    const latest = await db.outbox.get(action.id);
    if (!latest) continue;

    await updateAction(action.id, { status: "syncing" });
    try {
      await execute(latest);
      await removeAction(action.id);
      applied += 1;
    } catch (err) {
      if (isTransient(err)) {
        const attempts = latest.attempts + 1;
        await updateAction(action.id, { status: "pending", attempts, nextAttemptAt: Date.now() + retryDelay(attempts), error: null });
        break;
      }
      await updateAction(action.id, {
        status: "error",
        attempts: latest.attempts + 1,
        error: err instanceof Error ? err.message : "No se pudo guardar",
      });
    }
  }
  if (applied > 0) window.dispatchEvent(new Event(SYNCED_EVENT));
}

/** Acciones que se quedaron "enviando" porque se cerró la app a mitad de camino vuelven a pendientes. */
async function recoverInterrupted(): Promise<void> {
  const stuck = (await listOutbox()).filter((action) => action.status === "syncing");
  await Promise.all(stuck.map((action) => db.outbox.update(action.id, { status: "pending" })));
  if (stuck.length > 0) notifyOutbox();
}

let started = false;

/** Arranca la sincronización automática: al abrir la app, al volver la conexión y cada 30 s. */
export function startSync(): void {
  if (started) return;
  started = true;
  void recoverInterrupted().then(syncNow);
  window.addEventListener("online", () => void syncNow());
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void syncNow());
  window.setInterval(() => void syncNow(), 30_000);
}

// ---------------------------------------------------------------------------
// Guardar desde un formulario
// ---------------------------------------------------------------------------

export type SubmitResult<R> = { status: "saved"; result: R } | { status: "queued" };

/**
 * Guarda una acción: con conexión la envía en el momento (y un error de validación vuelve al
 * formulario); sin conexión, o si la red falla por el camino, queda ⏳ pendiente en la cola.
 * En ambos casos usa el mismo client_action_id, así un reintento nunca la duplica.
 */
export async function submitAction<T extends ActionType, R>(type: T, payload: ActionPayloads[T], label: string): Promise<SubmitResult<R>> {
  const id = crypto.randomUUID();
  const hasLocalPhotos = "photos" in payload && payload.photos.some((slot) => "localPhotoId" in slot);

  if (navigator.onLine && !hasLocalPhotos) {
    const action: OutboxAction<T> = { id, type, payload, label, status: "syncing", attempts: 0, error: null, createdAt: Date.now(), nextAttemptAt: 0 };
    try {
      return { status: "saved", result: (await execute(action as unknown as OutboxAction)) as R };
    } catch (err) {
      if (!isTransient(err)) throw err;
    }
  }

  await enqueue(type, payload, label, id);
  void syncNow();
  return { status: "queued" };
}
