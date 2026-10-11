import { Hono } from "hono";
import type { AppEnv } from "../env";
import { requireUser } from "../middleware/auth";
import { createUserRepository } from "../repositories/userRepository";
import { getMe } from "../services/meService";

export const meRoutes = new Hono<AppEnv>().use(requireUser).get("/", async (c) => {
  const user = c.get("user");
  // No bloquea la respuesta.
  c.executionCtx.waitUntil(createUserRepository(c.env.DB).touchLastSeen(user.id));
  return c.json(await getMe(c.env, user));
});
