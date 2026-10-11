import { Hono } from "hono";
import { relationshipSetupSchema } from "@shared/schemas";
import type { AppEnv } from "../env";
import { requireUser } from "../middleware/auth";
import { setupRelationship } from "../services/relationshipService";
import { parseJsonBody } from "../utils/validation";

export const relationshipRoutes = new Hono<AppEnv>().use(requireUser).post("/setup", async (c) => {
  const input = await parseJsonBody(c, relationshipSetupSchema);
  return c.json(await setupRelationship(c.env, c.get("user"), input), 201);
});
