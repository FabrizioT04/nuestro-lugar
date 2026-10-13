import { Hono } from "hono";
import { pushPreferencesSchema, pushSubscribeSchema, pushUnsubscribeSchema } from "@shared/schemas";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import { limitWrites } from "../middleware/rateLimit";
import { getPushConfig, sendTest, setPreferences, subscribe, unsubscribe } from "../services/notificationService";
import { parseJsonBody } from "../utils/validation";

// Notificaciones push: la clave pública, las suscripciones de cada dispositivo y qué avisos quiere cada persona.
export const pushRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship, limitWrites)
  .get("/", async (c) => c.json(await getPushConfig(c.env, c.get("user"))))
  .post("/subscriptions", async (c) => {
    const { endpoint, keys } = await parseJsonBody(c, pushSubscribeSchema);
    await subscribe(c.env, c.get("user"), endpoint, keys.p256dh, keys.auth);
    return c.body(null, 204);
  })
  // POST en vez de DELETE con cuerpo: algunos proxies descartan el cuerpo de un DELETE.
  .post("/subscriptions/remove", async (c) => {
    const { endpoint } = await parseJsonBody(c, pushUnsubscribeSchema);
    await unsubscribe(c.env, c.get("user"), endpoint);
    return c.body(null, 204);
  })
  .put("/preferences", async (c) => {
    const prefs = await parseJsonBody(c, pushPreferencesSchema);
    return c.json(await setPreferences(c.env, c.get("user"), prefs));
  })
  .post("/test", async (c) => {
    const { endpoint } = await parseJsonBody(c, pushUnsubscribeSchema);
    return c.json({ delivered: await sendTest(c.env, c.get("user"), endpoint) });
  });
