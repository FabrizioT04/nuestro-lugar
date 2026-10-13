import { Hono } from "hono";
import { sectionSeenSchema } from "@shared/schemas";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import { getHome, markSectionSeen } from "../services/homeService";
import { parseJsonBody } from "../utils/validation";

export const homeRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship)
  .get("/", async (c) => c.json(await getHome(c.env, c.get("user"))))
  /** Quien mira entró a una sección: se apagan sus globitos. */
  .post("/seen", async (c) => {
    const { section } = await parseJsonBody(c, sectionSeenSchema);
    await markSectionSeen(c.env, c.get("user"), section);
    return c.body(null, 204);
  });
