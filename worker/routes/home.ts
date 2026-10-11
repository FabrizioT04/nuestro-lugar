import { Hono } from "hono";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import { getHome } from "../services/homeService";

export const homeRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship)
  .get("/", async (c) => c.json(await getHome(c.env, c.get("user"))));
