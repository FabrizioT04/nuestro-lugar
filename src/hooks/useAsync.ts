import { useCallback, useEffect, useState } from "react";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string };

/** Carga datos al montar el componente, con reintento. Se reemplazará por una caché offline en la Fase 9. */
export function useAsync<T>(load: () => Promise<T>): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ status: "success", data }))
      .catch(
        (err: unknown) =>
          !cancelled && setState({ status: "error", message: err instanceof Error ? err.message : "Algo salió mal" }),
      );
    return () => {
      cancelled = true;
    };
    // `load` debe ser estable (definida fuera del componente o con useCallback).
  }, [load, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
