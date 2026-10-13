import type { ApiErrorBody, ApiErrorCode } from "@shared/api";
import { currentMediaToken, MobileNetworkError, mobileAccessToken, renewMobileSession } from "@/auth/mobileSession";
import { isNativeApp, MOBILE_API_ORIGIN } from "@/platform/native";

// Único punto por el que React habla con el backend. React nunca toca D1 ni R2:
// todo pasa por el Worker en /api.
//   - Web/PWA: mismo dominio; las cookies de Cloudflare Access viajan solas y no hace falta CORS.
//   - App de Android: el Worker `app-movil`, con el token de la app en la cabecera Authorization.

export type ClientErrorCode = ApiErrorCode | "network_error" | "session_expired";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ClientErrorCode,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE = isNativeApp ? `${MOBILE_API_ORIGIN}/api` : "/api";

/**
 * URL para <img>/<audio> de un archivo servido por el Worker. En la app se agrega el token de fotos,
 * porque esas etiquetas no pueden mandar la cabecera Authorization.
 */
export function mediaSrc(path: string): string {
  if (!isNativeApp) return `${API_BASE}${path}`;
  const token = currentMediaToken();
  return `${API_BASE}${path}${token ? `${path.includes("?") ? "&" : "?"}mt=${encodeURIComponent(token)}` : ""}`;
}

/** Cabecera de sesión de la app. Sin sesión, la petición ni sale: la app muestra el inicio de sesión. */
async function nativeAuthHeader(forceRenew: boolean): Promise<Record<string, string>> {
  let token: string | null;
  try {
    token = forceRenew ? await renewMobileSession() : await mobileAccessToken();
  } catch (err) {
    if (err instanceof MobileNetworkError) throw new ApiError(0, "network_error", "Sin conexión con el servidor");
    throw err;
  }
  if (!token) throw new ApiError(401, "session_expired", "Tu sesión terminó");
  return { authorization: `Bearer ${token}` };
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const auth = isNativeApp ? await nativeAuthHeader(retried) : {};
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: isNativeApp ? "omit" : "same-origin",
      // Cuando la sesión de Access expira, Access responde con una redirección a su página de
      // login (otro dominio). Seguirla desde fetch falla por CORS; así la detectamos limpiamente.
      redirect: "manual",
      headers: { accept: "application/json", ...init.headers, ...auth },
    });
  } catch {
    throw new ApiError(0, "network_error", "Sin conexión con el servidor");
  }

  // En la app, un 401 puede ser un token de acceso recién vencido: se renueva una vez y se reintenta.
  if (isNativeApp && response.status === 401 && !retried) return apiFetch<T>(path, init, true);

  if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
    throw new ApiError(401, "session_expired", "Tu sesión expiró");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      body?.error.code ?? "internal_error",
      body?.error.message ?? `Error ${response.status}`,
      body?.error.requestId,
    );
  }

  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

export function apiPost<T>(path: string, body: unknown, clientActionId?: string): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...actionHeader(clientActionId) },
    body: JSON.stringify(body),
  });
}

/**
 * Cabecera de idempotencia de la cola offline: el Worker no aplica dos veces una acción
 * con el mismo id (ver worker/middleware/idempotency.ts).
 */
export function actionHeader(clientActionId?: string): Record<string, string> {
  return clientActionId ? { "x-client-action-id": clientActionId } : {};
}
