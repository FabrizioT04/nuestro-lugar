import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";

// Cabeceras básicas para las respuestas de la API. Las respuestas con datos privados
// nunca deben quedar en cachés compartidas.
export const securityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  c.header("x-content-type-options", "nosniff");
  c.header("referrer-policy", "same-origin");
  if (!c.res.headers.has("cache-control")) {
    c.header("cache-control", "no-store");
  }
});
