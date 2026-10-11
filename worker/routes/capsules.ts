import { Hono } from "hono";
import { capsuleCreateSchema, capsuleInputSchema } from "@shared/schemas";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import { limitWrites } from "../middleware/rateLimit";
import {
  createCapsule,
  deleteCapsule,
  getCapsule,
  listCapsules,
  openCapsule,
  serveCapsuleMedia,
  updateCapsule,
} from "../services/capsuleService";
import { parseIdParam, parseJsonBody } from "../utils/validation";

export const capsuleRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship, limitWrites)
  .get("/", async (c) => c.json(await listCapsules(c.env, c.get("user"))))
  .post("/", async (c) => {
    const input = await parseJsonBody(c, capsuleCreateSchema);
    return c.json(await createCapsule(c.env, c.get("user"), input), 201);
  })
  .get("/:id", async (c) => c.json(await getCapsule(c.env, c.get("user"), parseIdParam(c))))
  .put("/:id", async (c) => {
    const id = parseIdParam(c);
    const input = await parseJsonBody(c, capsuleInputSchema);
    return c.json(await updateCapsule(c.env, c.get("user"), id, input));
  })
  .post("/:id/open", async (c) => c.json(await openCapsule(c.env, c.get("user"), parseIdParam(c))))
  .get("/:id/media/:mediaId", async (c) => {
    const size = c.req.query("size") === "thumb" ? "thumb" : "full";
    return serveCapsuleMedia(c.env, c.get("user"), parseIdParam(c), parseIdParam(c, "mediaId"), size, c.req.raw.headers);
  })
  .delete("/:id", async (c) => {
    await deleteCapsule(c.env, c.get("user"), parseIdParam(c));
    return c.body(null, 204);
  });
