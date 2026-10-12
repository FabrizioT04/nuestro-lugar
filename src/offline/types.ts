import type { LetterInput, MemoryInput } from "@shared/schemas";
import type { PlanStatusName } from "@shared/api";
import type { PlanPayload } from "@/services/api/plans";

/** Una foto del formulario: ya subida (mediaId) o guardada en el dispositivo hasta tener conexión. */
export type PhotoSlot = { mediaId: string } | { localPhotoId: string };

/** Acciones que se pueden hacer sin conexión. Cada una se reintenta con el mismo client_action_id. */
export interface ActionPayloads {
  "memory.create": { input: Omit<MemoryInput, "photoIds"> & { id: string }; photos: PhotoSlot[] };
  "memory.favorite": { memoryId: string; favorite: boolean };
  "plan.create": { input: Omit<PlanPayload, "photoIds"> & { id: string }; photos: PhotoSlot[] };
  "plan.status": { planId: string; status: PlanStatusName };
  "letter.create": { input: LetterInput & { id: string } };
}

export type ActionType = keyof ActionPayloads;

/** ⏳ pendiente · enviando · ⚠ error (necesita que alguien decida: reintentar o descartar). */
export type OutboxStatus = "pending" | "syncing" | "error";

export interface OutboxAction<T extends ActionType = ActionType> {
  /** client_action_id: el Worker lo usa para no aplicar dos veces la misma acción. */
  id: string;
  type: T;
  payload: ActionPayloads[T];
  /** Texto para mostrar en la lista de pendientes ("Recuerdo: Playa"). */
  label: string;
  status: OutboxStatus;
  attempts: number;
  error: string | null;
  createdAt: number;
  /** No reintentar antes de este instante (espera creciente tras fallos de red). */
  nextAttemptAt: number;
}
