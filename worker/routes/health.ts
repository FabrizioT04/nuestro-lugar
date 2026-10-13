import { Hono } from "hono";
import type { AppEnv } from "../env";
import { isMobileWorker } from "../middleware/auth";
import { notFoundHandler } from "../middleware/errorHandler";
import { getDatabaseHealth, getHealth } from "../services/healthService";

export const healthRoutes = new Hono<AppEnv>()
  .get("/", (c) => c.json(getHealth(c.env)))
  // El Worker móvil no tiene Access delante: ahí no se ofrece una ruta pública que consulte D1.
  .get("/db", async (c) => (isMobileWorker(c.env) ? notFoundHandler(c) : c.json(await getDatabaseHealth(c.env))));
