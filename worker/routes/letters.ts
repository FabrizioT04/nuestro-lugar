import { Hono } from "hono";
import { letterCreateSchema, letterInputSchema, letterListQuerySchema } from "@shared/schemas";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import { idempotent } from "../middleware/idempotency";
import { limitWrites } from "../middleware/rateLimit";
import { createLetter, deleteLetter, getLetter, listLetters, openLetter, updateLetter } from "../services/letterService";
import { parseIdParam, parseJsonBody, parseQuery } from "../utils/validation";

export const letterRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship, limitWrites, idempotent)
  .get("/", async (c) => {
    const { box } = parseQuery(c, letterListQuerySchema);
    return c.json(await listLetters(c.env, c.get("user"), box));
  })
  .post("/", async (c) => {
    const input = await parseJsonBody(c, letterCreateSchema);
    return c.json(await createLetter(c.env, c.get("user"), input), 201);
  })
  .get("/:id", async (c) => c.json(await getLetter(c.env, c.get("user"), parseIdParam(c))))
  .put("/:id", async (c) => {
    const id = parseIdParam(c);
    const input = await parseJsonBody(c, letterInputSchema);
    return c.json(await updateLetter(c.env, c.get("user"), id, input));
  })
  .post("/:id/open", async (c) => c.json(await openLetter(c.env, c.get("user"), parseIdParam(c))))
  .delete("/:id", async (c) => {
    await deleteLetter(c.env, c.get("user"), parseIdParam(c));
    return c.body(null, 204);
  });
