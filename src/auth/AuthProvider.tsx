import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError } from "@/services/api/client";
import { meApi } from "@/services/api/me";
import { AuthContext, type AuthState } from "./AuthContext";
import { reloadForLogin } from "./session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      setState({ status: "authenticated", me: await meApi.get() });
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setState({ status: "error", message: "Algo salió mal" });
      } else if (err.code === "session_expired" || err.code === "unauthorized") {
        if (!reloadForLogin()) setState({ status: "signed-out" });
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

  const value = useMemo(() => ({ state, refresh }), [state, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
