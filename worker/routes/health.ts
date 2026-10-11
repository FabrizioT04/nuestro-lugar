import { Hono } from "hono";
import type { AppEnv } from "../env";
import { getDatabaseHealth, getHealth } from "../services/healthService";

export const healthRoutes = new Hono<AppEnv>()
  .get("/", (c) => c.json(getHealth(c.env)))
  .get("/db", async (c) => c.json(await getDatabaseHealth(c.env)));
