import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useOutbox } from "@/hooks/useOutbox";
import { onSynced } from "@/offline/sync";

/**
 * Estado global de la sincronización, bajo el aviso de "sin conexión":
 * ⏳ N pendientes · ⚠ N con error (lleva al perfil) · ✓ Todo sincronizado (unos segundos).
 */
export function SyncIndicator() {
  const actions = useOutbox();
  const errors = actions.filter((action) => action.status === "error").length;
  const pending = actions.length - errors;
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const off = onSynced(() => {
      setJustSynced(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setJustSynced(false), 3000);
    });
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, []);

  if (errors > 0) {
    return (
      <Link to="/perfil#sincronizacion" role="status" className="block bg-blush-50 px-4 py-2 text-center text-sm font-semibold text-blush-700">
        ⚠ {errors === 1 ? "1 cosa no se pudo sincronizar" : `${errors} cosas no se pudieron sincronizar`} · Ver
      </Link>
    );
  }
  if (pending > 0) {
    return (
      <p role="status" className="bg-lavender-100 px-4 py-2 text-center text-sm font-semibold text-lavender-500">
        ⏳ {pending === 1 ? "1 cambio pendiente" : `${pending} cambios pendientes`} de sincronizar
      </p>
    );
  }
  if (justSynced) {
    return (
      <p role="status" className="animate-fade-in bg-sage-100 px-4 py-2 text-center text-sm font-semibold text-sage-700">
        ✓ Todo sincronizado
      </p>
    );
  }
  return null;
}
