import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";
import { rateLimited } from "../utils/errors";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Límite de escrituras por persona (crear, editar, borrar). Usar después de requireUser. */
export const limitWrites = createMiddleware<AppEnv>(async (c, next) => {
  if (!READ_METHODS.has(c.req.method)) {
    const { success } = await c.env.WRITE_LIMITER.limit({ key: c.get("user").id });
    if (!success) throw rateLimited();
  }
  await next();
});

/** Límite de consultas a Google Places por persona: cuida la cuota diaria (y que no haya costos). */
export const limitPlaces = createMiddleware<AppEnv>(async (c, next) => {
  const { success } = await c.env.PLACES_LIMITER.limit({ key: c.get("user").id });
  if (!success) throw rateLimited("Muchas búsquedas seguidas. Espera un minuto.");
  await next();
});
