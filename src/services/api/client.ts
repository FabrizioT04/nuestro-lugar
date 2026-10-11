import type { ApiErrorBody, ApiErrorCode } from "@shared/api";

// Único punto por el que React habla con el backend. React nunca toca D1 ni R2:
// todo pasa por el Worker en /api, en el mismo dominio (las cookies de Cloudflare
// Access viajan solas y no hace falta CORS).

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | "network_error",
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
      headers: { accept: "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError(0, "network_error", "Sin conexión con el servidor");
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

  return (await response.json()) as T;
}
