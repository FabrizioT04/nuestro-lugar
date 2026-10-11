import type { ApiErrorBody, ApiErrorCode } from "@shared/api";

// Único punto por el que React habla con el backend. React nunca toca D1 ni R2:
// todo pasa por el Worker en /api, en el mismo dominio (las cookies de Cloudflare
// Access viajan solas y no hace falta CORS).

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

const API_BASE = "/api";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "same-origin",
      // Cuando la sesión de Access expira, Access responde con una redirección a su página de
      // login (otro dominio). Seguirla desde fetch falla por CORS; así la detectamos limpiamente.
      redirect: "manual",
      headers: { accept: "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError(0, "network_error", "Sin conexión con el servidor");
  }

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

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
