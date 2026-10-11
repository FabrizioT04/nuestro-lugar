import { Hono } from "hono";
import { coverSchema, relationshipSetupSchema } from "@shared/schemas";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import { limitWrites } from "../middleware/rateLimit";
import { setCoverPhoto, setupRelationship } from "../services/relationshipService";
import { parseJsonBody } from "../utils/validation";

export const relationshipRoutes = new Hono<AppEnv>()
  .use(requireUser, limitWrites)
  .post("/setup", async (c) => {
    const input = await parseJsonBody(c, relationshipSetupSchema);
    return c.json(await setupRelationship(c.env, c.get("user"), input), 201);
  })
  // Foto principal del inicio (o null para volver a la ilustración).
  .put("/cover", requireRelationship, async (c) => {
    const { mediaId } = await parseJsonBody(c, coverSchema);
    await setCoverPhoto(c.env, c.get("user"), mediaId);
    return c.json({ coverMediaId: mediaId });
  });
