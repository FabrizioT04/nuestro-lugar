import { Hono } from "hono";
import {
  GOOGLE_PLACE_ID,
  geocodeQuerySchema,
  originQuerySchema,
  placeInteractionSchema,
  placePreferencesSchema,
  placeSearchSchema,
} from "@shared/schemas";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import { idempotent } from "../middleware/idempotency";
import { limitPlaces, limitWrites } from "../middleware/rateLimit";
import {
  geocode,
  getPlacePreferences,
  listSavedPlaces,
  recommendPlaces,
  savePlacePreferences,
  setPlaceInteraction,
} from "../services/placeService";
import { notFound } from "../utils/errors";
import { parseJsonBody, parseQuery } from "../utils/validation";

// "¿Qué hacemos hoy?". Las rutas que consultan a Google pasan por limitPlaces (cuota diaria).
export const placeRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship, limitWrites, idempotent)
  // POST porque lleva la ubicación y el texto: no deben quedar en URLs ni en logs de acceso.
  .post("/recommendations", limitPlaces, async (c) => {
    const input = await parseJsonBody(c, placeSearchSchema);
    return c.json(await recommendPlaces(c.env, c.get("user"), input));
  })
  .get("/saved", limitPlaces, async (c) => {
    const { lat, lng } = parseQuery(c, originQuerySchema);
    const origin = lat !== undefined && lng !== undefined ? { lat, lng } : null;
    return c.json(await listSavedPlaces(c.env, c.get("user"), origin));
  })
  .get("/geocode", limitPlaces, async (c) => {
    const { q } = parseQuery(c, geocodeQuerySchema);
    return c.json(await geocode(c.env, q));
  })
  .get("/preferences", async (c) => c.json(await getPlacePreferences(c.env, c.get("user"))))
  .put("/preferences", async (c) => {
    const input = await parseJsonBody(c, placePreferencesSchema);
    return c.json(await savePlacePreferences(c.env, c.get("user"), input));
  })
  .put("/:placeId/interactions", async (c) => {
    const placeId = c.req.param("placeId");
    if (!GOOGLE_PLACE_ID.test(placeId)) throw notFound();
    const input = await parseJsonBody(c, placeInteractionSchema);
    return c.json(await setPlaceInteraction(c.env, c.get("user"), placeId, input));
  });
