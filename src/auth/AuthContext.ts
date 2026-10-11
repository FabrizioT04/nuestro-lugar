import { createContext, useContext } from "react";
import type { MeResponse } from "@shared/api";

export type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; me: MeResponse }
  | { status: "denied"; message: string }
  | { status: "signed-out" }
  | { status: "error"; message: string };

export interface AuthContextValue {
  state: AuthState;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return value;
}

/** Atajo para pantallas que solo se muestran con sesión iniciada. */
export function useMe(): MeResponse {
  const { state } = useAuth();
  if (state.status !== "authenticated") throw new Error("useMe requiere una sesión iniciada");
  return state.me;
}
