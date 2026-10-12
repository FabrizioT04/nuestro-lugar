import { Hono } from "hono";
import { planCreateSchema, planInputSchema, planStatusSchema } from "@shared/schemas";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import { idempotent } from "../middleware/idempotency";
import { limitWrites } from "../middleware/rateLimit";
import {
  convertPlanToMemory,
  createPlan,
  deletePlan,
  getPlan,
  listPlans,
  setPlanStatus,
  updatePlan,
} from "../services/planService";
import { parseIdParam, parseJsonBody } from "../utils/validation";

export const planRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship, limitWrites, idempotent)
  .get("/", async (c) => c.json(await listPlans(c.env, c.get("user"))))
  .post("/", async (c) => {
    const input = await parseJsonBody(c, planCreateSchema);
    return c.json(await createPlan(c.env, c.get("user"), input), 201);
  })
  .get("/:id", async (c) => c.json(await getPlan(c.env, c.get("user"), parseIdParam(c))))
  .put("/:id", async (c) => {
    const id = parseIdParam(c);
    const input = await parseJsonBody(c, planInputSchema);
    return c.json(await updatePlan(c.env, c.get("user"), id, input));
  })
  .put("/:id/status", async (c) => {
    const id = parseIdParam(c);
    const { status } = await parseJsonBody(c, planStatusSchema);
    return c.json(await setPlanStatus(c.env, c.get("user"), id, status));
  })
  // Convierte un plan realizado en recuerdo. 201 si lo crea; 200 si ya existía.
  .post("/:id/memory", async (c) => {
    const result = await convertPlanToMemory(c.env, c.get("user"), parseIdParam(c));
    return c.json({ memoryId: result.memoryId }, result.created ? 201 : 200);
  })
  .delete("/:id", async (c) => {
    await deletePlan(c.env, c.get("user"), parseIdParam(c));
    return c.body(null, 204);
  });
