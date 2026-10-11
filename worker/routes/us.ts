import { Hono } from "hono";
import { importantDateCreateSchema, importantDateInputSchema } from "@shared/schemas";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import { limitWrites } from "../middleware/rateLimit";
import {
  createImportantDate,
  deleteImportantDate,
  getImportantDate,
  updateImportantDate,
} from "../services/importantDateService";
import { getTimeline, getUs, loadRelationship } from "../services/usService";
import { parseIdParam, parseJsonBody } from "../utils/validation";

/** "Nosotros": resumen de la pareja y su línea de tiempo. */
export const usRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship)
  .get("/", async (c) => c.json(await getUs(c.env, c.get("user"))))
  .get("/timeline", async (c) => c.json(await getTimeline(c.env, c.get("user"))));

/** Fechas importantes (alimentan "Próximo momento" y la línea de tiempo). */
export const importantDateRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship, limitWrites)
  .post("/", async (c) => {
    const input = await parseJsonBody(c, importantDateCreateSchema);
    const { today } = await loadRelationship(c.env, c.get("user"));
    return c.json(await createImportantDate(c.env, c.get("user"), input, today), 201);
  })
  .get("/:id", async (c) => {
    const { today } = await loadRelationship(c.env, c.get("user"));
    return c.json(await getImportantDate(c.env, c.get("user"), parseIdParam(c), today));
  })
  .put("/:id", async (c) => {
    const id = parseIdParam(c);
    const input = await parseJsonBody(c, importantDateInputSchema);
    const { today } = await loadRelationship(c.env, c.get("user"));
    return c.json(await updateImportantDate(c.env, c.get("user"), id, input, today));
  })
  .delete("/:id", async (c) => {
    await deleteImportantDate(c.env, c.get("user"), parseIdParam(c));
    return c.body(null, 204);
  });
