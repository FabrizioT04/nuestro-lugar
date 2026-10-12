import { useCallback, useEffect, useRef, useState } from "react";
import { readCache, writeCache } from "@/offline/cache";
import { onSynced } from "@/offline/sync";
import { ApiError } from "@/services/api/client";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "success"; data: T; /** true si son datos guardados en el dispositivo y no se pudieron actualizar. */ stale: boolean }
  | { status: "error"; message: string };

export interface AsyncOptions<T> {
  /** Guarda la respuesta en el dispositivo para mostrarla sin conexión. */
  cacheKey?: string;
  /** Solo se guarda si devuelve true (por ejemplo, nunca contenido bloqueado). */
  cacheIf?: (data: T) => boolean;
}

const OFFLINE_NO_COPY = "Sin conexión, y todavía no hay una copia guardada en este dispositivo.";

/**
 * Carga datos al montar el componente. Con `cacheKey` muestra al instante la última copia
 * guardada, la reemplaza cuando llega la respuesta del Worker y, si no hay conexión, se queda
 * con la copia (stale = true). Vuelve a cargar sola cuando la cola offline termina de sincronizar.
 */
export function useAsync<T>(load: () => Promise<T>, options: AsyncOptions<T> = {}): AsyncState<T> & { reload: () => void } {
  const { cacheKey } = options;
  const cacheIfRef = useRef(options.cacheIf);
  cacheIfRef.current = options.cacheIf;
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let fresh = false;
    let cached: T | undefined;

    if (cacheKey) {
      void readCache<T>(cacheKey).then((entry) => {
        if (cancelled || fresh || !entry) return;
        cached = entry.value;
        setState({ status: "success", data: entry.value, stale: false });
      });
    }

    load()
      .then((data) => {
        fresh = true;
        if (cancelled) return;
        setState({ status: "success", data, stale: false });
        if (cacheKey && (cacheIfRef.current?.(data) ?? true)) void writeCache(cacheKey, data);
      })
      .catch(async (err: unknown) => {
        if (cancelled) return;
        const offline = err instanceof ApiError && err.code === "network_error";
        if (offline && cacheKey) {
          cached ??= (await readCache<T>(cacheKey))?.value;
          if (cancelled) return;
          if (cached !== undefined) {
            setState({ status: "success", data: cached, stale: true });
            return;
          }
        }
        setState({ status: "error", message: offline ? OFFLINE_NO_COPY : err instanceof Error ? err.message : "Algo salió mal" });
      });
    return () => {
      cancelled = true;
    };
    // `load` debe ser estable (definida fuera del componente o con useCallback).
  }, [load, attempt, cacheKey]);

  // Cuando se sincroniza la cola, los datos del servidor cambiaron: recargar sin parpadeo.
  useEffect(() => onSynced(() => setAttempt((n) => n + 1)), []);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
