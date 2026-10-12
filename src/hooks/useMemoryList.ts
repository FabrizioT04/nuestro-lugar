import { useCallback, useEffect, useRef, useState } from "react";
import type { MemoryListResponse, MemorySummary } from "@shared/api";
import { readCache, writeCache } from "@/offline/cache";
import { onSynced } from "@/offline/sync";
import { ApiError } from "@/services/api/client";
import { memoriesApi, type MemoryListParams } from "@/services/api/memories";

const OFFLINE_NO_COPY = "Sin conexión, y todavía no hay una copia guardada en este dispositivo.";

type Status = "loading" | "ready" | "loading-more" | "error";

/**
 * Lista paginada de recuerdos que se recarga cuando cambian los filtros.
 * La primera página (sin búsqueda de texto) se guarda en el dispositivo para verla sin conexión.
 */
export function useMemoryList(params: Omit<MemoryListParams, "cursor">) {
  const [items, setItems] = useState<MemorySummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify(params);
  const silent = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let fresh = false;
    const params = JSON.parse(key) as MemoryListParams;
    const cacheKey = params.q ? null : `memories:${key}`;
    if (silent.current) silent.current = false;
    else setStatus("loading");

    const show = (page: MemoryListResponse) => {
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setStatus("ready");
    };

    if (cacheKey) {
      void readCache<MemoryListResponse>(cacheKey).then((entry) => {
        if (!cancelled && !fresh && entry) show(entry.value);
      });
    }

    memoriesApi
      .list(params)
      .then((page) => {
        fresh = true;
        if (cancelled) return;
        show(page);
        if (cacheKey) void writeCache(cacheKey, page);
      })
      .catch(async (err: unknown) => {
        if (cancelled) return;
        const offline = err instanceof ApiError && err.code === "network_error";
        const cached = offline && cacheKey ? await readCache<MemoryListResponse>(cacheKey) : undefined;
        if (cancelled) return;
        if (cached) {
          show(cached.value);
          return;
        }
        setError(offline ? OFFLINE_NO_COPY : err instanceof Error ? err.message : "No se pudieron cargar los recuerdos");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  // Al sincronizar la cola, los recuerdos creados sin conexión ya existen en el Worker.
  useEffect(
    () =>
      onSynced(() => {
        silent.current = true; // recargar sin volver a mostrar el esqueleto
        setAttempt((n) => n + 1);
      }),
    [],
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setStatus("loading-more");
    try {
      const page = await memoriesApi.list({ ...(JSON.parse(key) as MemoryListParams), cursor: nextCursor });
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar más recuerdos");
      setStatus("error");
    }
  }, [key, nextCursor]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { items, status, error, hasMore: nextCursor !== null, loadMore, reload };
}
