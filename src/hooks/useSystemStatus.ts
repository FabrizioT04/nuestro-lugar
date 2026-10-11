import { useEffect, useState } from "react";
import type { DatabaseHealthResponse, HealthResponse } from "@shared/api";
import { healthApi } from "@/services/api/health";

type Status =
  | { state: "loading" }
  | { state: "ok"; api: HealthResponse; db: DatabaseHealthResponse }
  | { state: "error"; message: string };

/** Comprueba React → Worker → D1. Solo para verificar la Fase 1. */
export function useSystemStatus(): Status {
  const [status, setStatus] = useState<Status>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([healthApi.get(), healthApi.database()])
      .then(([api, db]) => !cancelled && setStatus({ state: "ok", api, db }))
      .catch((err: unknown) =>
        !cancelled && setStatus({ state: "error", message: err instanceof Error ? err.message : "Error desconocido" }),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
