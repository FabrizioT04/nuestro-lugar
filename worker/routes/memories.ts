import { Hono } from "hono";
import { favoriteSchema, memoryCreateSchema, memoryInputSchema, memoryListQuerySchema, memorySearchSchema } from "@shared/schemas";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import { idempotent } from "../middleware/idempotency";
import { limitAi, limitWrites } from "../middleware/rateLimit";
import {
  createMemory,
  deleteMemory,
  getMemory,
  getMemoryFilters,
  listMemories,
  setMemoryFavorite,
  updateMemory,
} from "../services/memoryService";
import { searchMemories } from "../services/memorySearchService";
import { inBackground, notifyNewMemory } from "../services/notificationService";
import { parseIdParam, parseJsonBody, parseQuery } from "../utils/validation";

export const memoryRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship, limitWrites, idempotent)
  .get("/", async (c) => c.json(await listMemories(c.env, c.get("user"), parseQuery(c, memoryListQuerySchema))))
  // Búsqueda con IA. POST para que la pregunta no quede en URLs ni en logs de acceso.
  .post("/search", limitAi, async (c) => {
    const { question } = await parseJsonBody(c, memorySearchSchema);
    return c.json(await searchMemories(c.env, c.get("user"), question));
  })
  .get("/filters", async (c) => c.json(await getMemoryFilters(c.env, c.get("user"))))
  .post("/", async (c) => {
    const input = await parseJsonBody(c, memoryCreateSchema);
    const created = await createMemory(c.env, c.get("user"), input);
    inBackground(c, notifyNewMemory(c.env, c.get("user"), created));
    return c.json(created, 201);
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
