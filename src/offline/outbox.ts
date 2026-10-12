import { db, type StoredPhoto } from "./db";
import type { ActionPayloads, ActionType, OutboxAction, PhotoSlot } from "./types";

// Cola de acciones pendientes (patrón Outbox). Lo que se crea o cambia sin conexión se guarda
// aquí con su client_action_id y se envía al Worker cuando vuelve Internet (ver sync.ts).

type Listener = () => void;
const listeners = new Set<Listener>();

/** Avisa a la interfaz de que la cola cambió. */
export function notifyOutbox(): void {
  for (const listener of listeners) listener();
}

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function listOutbox(): Promise<OutboxAction[]> {
  try {
    return await db.outbox.orderBy("createdAt").toArray();
  } catch {
    return [];
  }
}

export async function enqueue<T extends ActionType>(type: T, payload: ActionPayloads[T], label: string, id = crypto.randomUUID()): Promise<OutboxAction<T>> {
  const action: OutboxAction<T> = {
    id,
    type,
    payload,
    label,
    status: "pending",
    attempts: 0,
    error: null,
    createdAt: Date.now(),
    nextAttemptAt: 0,
  };
  await db.outbox.put(action as unknown as OutboxAction);
  notifyOutbox();
  return action;
}

export async function updateAction(id: string, changes: Partial<OutboxAction>): Promise<void> {
  await db.outbox.update(id, changes);
  notifyOutbox();
}

/** Quita una acción de la cola y las fotos locales que solo ella usaba. */
export async function removeAction(id: string): Promise<void> {
  const action = await db.outbox.get(id);
  if (!action) return;
  await db.transaction("rw", db.outbox, db.photos, async () => {
    await db.outbox.delete(id);
    const photoIds = localPhotoIds(action);
    if (photoIds.length > 0) await db.photos.bulkDelete(photoIds);
  });
  notifyOutbox();
}

/** Vuelve a intentar una acción con error (por ejemplo, después de corregir la conexión). */
export function retryAction(id: string): Promise<void> {
  return updateAction(id, { status: "pending", error: null, nextAttemptAt: 0 });
}

function slotsOf(action: OutboxAction): PhotoSlot[] {
  return "photos" in action.payload ? action.payload.photos : [];
}

export function localPhotoIds(action: OutboxAction): string[] {
  return slotsOf(action).flatMap((slot) => ("localPhotoId" in slot ? [slot.localPhotoId] : []));
}

export async function saveLocalPhoto(photo: Omit<StoredPhoto, "id">): Promise<string> {
  const id = crypto.randomUUID();
  await db.photos.put({ ...photo, id });
  return id;
}

export function getLocalPhoto(id: string): Promise<StoredPhoto | undefined> {
  return db.photos.get(id);
}
