import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MeResponse } from "@shared/api";
import { bindOwner, readCache, writeCache } from "@/offline/cache";
import { ApiError } from "@/services/api/client";
import { meApi } from "@/services/api/me";
import { isNativeApp } from "@/platform/native";
import { AuthContext, type AuthState } from "./AuthContext";
import { onMobileSessionChange } from "./mobileSession";
import { reloadForLogin } from "./session";

const ME_CACHE_KEY = "me";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const me = await meApi.get();
      // Primero se comprueba de quién son los datos guardados; si son de otra persona, se borran.
      await bindOwner(me.user.id);
      void writeCache(ME_CACHE_KEY, me);
      setState({ status: "authenticated", me });
    } catch (err) {
      // Sin conexión: se entra con la última sesión conocida de este dispositivo (solo lectura de
      // lo guardado; el Worker vuelve a comprobar todo cuando hay conexión).
      const offline = err instanceof ApiError && err.code === "network_error";
      const cached = offline ? await readCache<MeResponse>(ME_CACHE_KEY) : null;
      if (cached) {
        setState({ status: "authenticated", me: cached.value });
      } else if (!(err instanceof ApiError)) {
        setState({ status: "error", message: "Algo salió mal" });
      } else if (err.code === "session_expired" || err.code === "unauthorized") {
        // En la app no hay Access que recargar: se muestra la pantalla para entrar con Google.
        if (isNativeApp || !reloadForLogin()) setState({ status: "signed-out" });
      } else if (err.code === "forbidden") {
        setState({ status: "denied", message: err.message });
      } else {
        setState({ status: "error", message: err.message });
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // App: al entrar o salir (o si falla el inicio de sesión) se vuelve a preguntar quién es.
  useEffect(() => (isNativeApp ? onMobileSessionChange(() => void refresh()) : undefined), [refresh]);

  const value = useMemo(() => ({ state, refresh }), [state, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
