import { Hono } from "hono";
import { favoriteSchema, memoryCreateSchema, memoryInputSchema, memoryListQuerySchema } from "@shared/schemas";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import {
  createMemory,
  deleteMemory,
  getMemory,
  getMemoryFilters,
  listMemories,
  setMemoryFavorite,
  updateMemory,
} from "../services/memoryService";
import { parseIdParam, parseJsonBody, parseQuery } from "../utils/validation";

export const memoryRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship)
  .get("/", async (c) => c.json(await listMemories(c.env, c.get("user"), parseQuery(c, memoryListQuerySchema))))
  .get("/filters", async (c) => c.json(await getMemoryFilters(c.env, c.get("user"))))
  .post("/", async (c) => {
    const input = await parseJsonBody(c, memoryCreateSchema);
    return c.json(await createMemory(c.env, c.get("user"), input), 201);
  })
  .get("/:id", async (c) => c.json(await getMemory(c.env, c.get("user"), parseIdParam(c))))
  .put("/:id", async (c) => {
    const id = parseIdParam(c);
    const input = await parseJsonBody(c, memoryInputSchema);
    return c.json(await updateMemory(c.env, c.get("user"), id, input));
  })
  .delete("/:id", async (c) => {
    await deleteMemory(c.env, c.get("user"), parseIdParam(c));
    return c.body(null, 204);
  })
  .put("/:id/favorite", async (c) => {
    const id = parseIdParam(c);
    const { favorite } = await parseJsonBody(c, favoriteSchema);
    await setMemoryFavorite(c.env, c.get("user"), id, favorite);
    return c.json({ favorite });
  });
