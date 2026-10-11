import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import { serveMedia, uploadPhoto } from "../services/mediaService";
import { badRequest, notFound, payloadTooLarge } from "../utils/errors";
import { MAX_UPLOAD_REQUEST_BYTES } from "../utils/media";

const mediaId = z.uuid();

export const mediaRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship)
  .post("/", async (c) => {
    // Se rechaza antes de leer el cuerpo si declara ser demasiado grande.
    const declared = Number(c.req.header("content-length") ?? 0);
    if (declared > MAX_UPLOAD_REQUEST_BYTES) throw payloadTooLarge("El archivo es demasiado grande");
    if (!c.req.header("content-type")?.startsWith("multipart/form-data")) {
      throw badRequest("Se esperaba multipart/form-data");
    }
    const form = await c.req.formData().catch(() => {
      throw badRequest("No se pudo leer el archivo");
    });
    return c.json(await uploadPhoto(c.env, c.get("user"), form), 201);
  })
  .get("/:id", async (c) => {
    const id = mediaId.safeParse(c.req.param("id"));
    if (!id.success) throw notFound("Foto no encontrada");
    const size = c.req.query("size") === "thumb" ? "thumb" : "full";
    return serveMedia(c.env, c.get("user"), id.data, size, c.req.raw.headers);
  });
