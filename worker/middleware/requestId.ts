import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";

// Asigna un id a cada petición (usa el Ray ID de Cloudflare si existe) para poder
// relacionar un error que ve el usuario con los logs del Worker.
export const requestId = createMiddleware<AppEnv>(async (c, next) => {
  const id = c.req.header("cf-ray") ?? crypto.randomUUID();
  c.set("requestId", id);
  await next();
  c.header("x-request-id", id);
});
