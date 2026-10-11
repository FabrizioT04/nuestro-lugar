import { useCallback, useEffect, useState } from "react";
import type { MemorySummary } from "@shared/api";
import { memoriesApi, type MemoryListParams } from "@/services/api/memories";

type Status = "loading" | "ready" | "loading-more" | "error";

/** Lista paginada de recuerdos que se recarga cuando cambian los filtros. */
export function useMemoryList(params: Omit<MemoryListParams, "cursor">) {
  const [items, setItems] = useState<MemorySummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    memoriesApi
      .list(JSON.parse(key) as MemoryListParams)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "No se pudieron cargar los recuerdos");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

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
