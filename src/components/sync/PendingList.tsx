import { RotateCcw, Trash2 } from "lucide-react";
import { useOutbox } from "@/hooks/useOutbox";
import { removeAction, retryAction } from "@/offline/outbox";
import { syncNow } from "@/offline/sync";
import type { ActionType, OutboxAction } from "@/offline/types";
import { SyncChip } from "./SyncChip";

interface Props<T extends ActionType> {
  type: T;
  /** Texto bajo el título, por ejemplo la fecha del recuerdo. */
  describe?: (action: OutboxAction<T>) => string | null;
}

/**
 * Lo que se creó sin conexión y aún no llegó al Worker. No se puede abrir todavía
 * (no existe en el servidor), pero se ve con su estado ⏳ o ⚠.
 */
export function PendingList<T extends ActionType>({ type, describe }: Props<T>) {
  const actions = useOutbox(type);
  if (actions.length === 0) return null;

  return (
    <ul className="mb-4 space-y-3" aria-label="Pendientes de sincronizar">
      {actions.map((action) => (
        <li key={action.id}>
          <PendingCard action={action} detail={describe?.(action) ?? null} />
        </li>
      ))}
    </ul>
  );
}

export function PendingCard({ action, detail }: { action: OutboxAction; detail?: string | null }) {
  return (
    <div className="rounded-card border-2 border-dashed border-lavender-300 bg-paper/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 font-semibold break-words">{action.label}</p>
          {detail && <p className="text-sm text-ink-soft">{detail}</p>}
        </div>
        <span className="shrink-0">
          <SyncChip status={action.status} />
        </span>
      </div>
      {action.status === "error" ? (
        <>
          <p className="mt-2 text-sm text-blush-700">{action.error}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void retryAction(action.id).then(syncNow)}
              className="inline-flex items-center gap-1.5 rounded-full bg-lavender-100 px-3 py-1.5 text-sm font-semibold text-lavender-500"
            >
              <RotateCcw size={14} aria-hidden /> Reintentar
            </button>
            <button
              type="button"
              onClick={() => void removeAction(action.id)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-blush-50"
            >
              <Trash2 size={14} aria-hidden /> Descartar
            </button>
          </div>
        </>
      ) : (
        <p className="mt-1 text-xs text-ink-soft">Guardado en este dispositivo. Se enviará solo al volver la conexión.</p>
      )}
    </div>
  );
}
