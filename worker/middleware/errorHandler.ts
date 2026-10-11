import type { ErrorHandler, NotFoundHandler } from "hono";
import type { ApiErrorBody } from "@shared/api";
import type { AppEnv } from "../env";
import { AppError } from "../utils/errors";

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get("requestId");

  if (err instanceof AppError) {
    return c.json<ApiErrorBody>({ error: { code: err.code, message: err.message, requestId } }, err.status);
  }

  // Detalles solo en los logs del Worker, nunca en la respuesta.
  console.error(JSON.stringify({ level: "error", requestId, message: err.message, stack: err.stack }));
  return c.json<ApiErrorBody>(
    { error: { code: "internal_error", message: "Algo salió mal. Inténtalo de nuevo.", requestId } },
    500,
  );
};

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) =>
  c.json<ApiErrorBody>(
    { error: { code: "not_found", message: "Ruta de API no encontrada", requestId: c.get("requestId") } },
    404,
  );
