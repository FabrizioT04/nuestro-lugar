import { Hono } from "hono";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import { idempotent } from "../middleware/idempotency";
import { limitWrites } from "../middleware/rateLimit";
import { createDrawing, deleteDrawing, listDrawings, serveDrawing } from "../services/drawingService";
import { inBackground, notifyNewDrawing } from "../services/notificationService";
import { badRequest, payloadTooLarge } from "../utils/errors";
import { MAX_UPLOAD_REQUEST_BYTES } from "../utils/media";
import { parseIdParam } from "../utils/validation";

/** Fotos de dibujos que uno le deja al otro. */
export const drawingRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship, limitWrites, idempotent)
  .get("/", async (c) => c.json(await listDrawings(c.env, c.get("user"))))
  .post("/", async (c) => {
    if (Number(c.req.header("content-length") ?? 0) > MAX_UPLOAD_REQUEST_BYTES) throw payloadTooLarge("La foto es demasiado grande");
    if (!c.req.header("content-type")?.startsWith("multipart/form-data")) throw badRequest("Se esperaba multipart/form-data");
    const form = await c.req.formData().catch(() => {
      throw badRequest("No se pudo leer la foto");
    });
    const created = await createDrawing(c.env, c.get("user"), form);
    inBackground(c, notifyNewDrawing(c.env, c.get("user"), created));
    return c.json(created, 201);
  })
  .get("/:id/image", async (c) => {
    const size = c.req.query("size") === "thumb" ? "thumb" : "full";
    return serveDrawing(c.env, c.get("user"), parseIdParam(c), size, c.req.raw.headers);
  })
  .delete("/:id", async (c) => {
    await deleteDrawing(c.env, c.get("user"), parseIdParam(c));
    return c.body(null, 204);
  });
