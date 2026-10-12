import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOutbox } from "@/hooks/useOutbox";
import { syncNow } from "@/offline/sync";
import { PendingCard } from "./PendingList";
import { SyncChip } from "./SyncChip";

/** Perfil → Sincronización: todo lo que espera para enviarse, con Reintentar y Descartar si falló. */
export function SyncSection() {
  const actions = useOutbox();
  const online = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);

  async function syncAll() {
    setSyncing(true);
    try {
      await syncNow();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card id="sincronizacion" className="scroll-mt-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Sincronización</p>
        {actions.length === 0 && <SyncChip status="synced" />}
      </div>
      {actions.length === 0 ? (
        <p className="text-sm text-ink-soft">Todo lo que guardaron en este dispositivo ya está a salvo en Nuestro Lugar.</p>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            {actions.every((action) => action.status === "error")
              ? "No se pudieron guardar estos cambios. Puedes reintentarlos o descartarlos."
              : online
                ? "Esto se está enviando."
                : "Sin conexión: se enviará solo cuando vuelva Internet."}
          </p>
          <ul className="space-y-3">
            {actions.map((action) => (
              <li key={action.id}>
                <PendingCard action={action} />
              </li>
            ))}
          </ul>
          {online && (
            <button
              type="button"
              onClick={syncAll}
              disabled={syncing}
              className="inline-flex items-center gap-2 text-sm font-semibold text-lavender-500 disabled:opacity-60"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} aria-hidden /> Sincronizar ahora
            </button>
          )}
        </>
      )}
    </Card>
  );
}
