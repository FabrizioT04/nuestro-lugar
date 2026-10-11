import type { ApiErrorCode } from "@shared/api";
import type { ContentfulStatusCode } from "hono/utils/http-status";

// Error controlado: su mensaje sí puede llegar al cliente.
// Cualquier otro error se responde como "internal_error" sin detalles.
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (message = "Recurso no encontrado") => new AppError(404, "not_found", message);
export const badRequest = (message = "Solicitud inválida") => new AppError(400, "bad_request", message);
export const forbidden = (message = "No tienes acceso a este recurso") => new AppError(403, "forbidden", message);
export const unauthorized = (message = "Necesitas iniciar sesión") => new AppError(401, "unauthorized", message);
export const conflict = (message: string) => new AppError(409, "conflict", message);
/** Falta configuración en el servidor. Se responde 500 sin revelar qué falta. */
export const misconfigured = () =>
  new AppError(500, "misconfigured", "El servidor no está configurado correctamente");
