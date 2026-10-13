import { Hono } from "hono";
import { plantNameSchema } from "@shared/schemas";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import { idempotent } from "../middleware/idempotency";
import { limitWrites } from "../middleware/rateLimit";
import { getPlant, renamePlant, waterPlant } from "../services/plantService";
import { parseJsonBody } from "../utils/validation";

/** La plantita de los dos. */
export const plantRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship, limitWrites, idempotent)
  .get("/", async (c) => c.json(await getPlant(c.env, c.get("user"))))
  .post("/water", async (c) => c.json(await waterPlant(c.env, c.get("user"))))
  .put("/name", async (c) => {
    const { name } = await parseJsonBody(c, plantNameSchema);
    return c.json(await renamePlant(c.env, c.get("user"), name));
  });
