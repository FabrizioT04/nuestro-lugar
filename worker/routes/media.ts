import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { requireRelationship, requireUser } from "../middleware/auth";
import { serveMedia, uploadAudio, uploadPhoto } from "../services/mediaService";
import { badRequest, notFound, payloadTooLarge } from "../utils/errors";
import { MAX_AUDIO_REQUEST_BYTES, MAX_UPLOAD_REQUEST_BYTES } from "../utils/media";

const mediaId = z.uuid();

/** Rechaza antes de leer el cuerpo si declara ser demasiado grande y lo lee como formulario. */
async function readUploadForm(c: Context<AppEnv>, maxBytes: number): Promise<FormData> {
  const declared = Number(c.req.header("content-length") ?? 0);
  if (declared > maxBytes) throw payloadTooLarge("El archivo es demasiado grande");
  if (!c.req.header("content-type")?.startsWith("multipart/form-data")) {
    throw badRequest("Se esperaba multipart/form-data");
  }
  return c.req.formData().catch(() => {
    throw badRequest("No se pudo leer el archivo");
  });
}

export const mediaRoutes = new Hono<AppEnv>()
  .use(requireUser, requireRelationship)
  .post("/", async (c) => {
    const form = await readUploadForm(c, MAX_UPLOAD_REQUEST_BYTES);
    return c.json(await uploadPhoto(c.env, c.get("user"), form), 201);
  })
  // Audios de las cápsulas del futuro (se sirven por /api/capsules, nunca por aquí).
  .post("/audio", async (c) => {
    const form = await readUploadForm(c, MAX_AUDIO_REQUEST_BYTES);
    return c.json(await uploadAudio(c.env, c.get("user"), form), 201);
  })
  .get("/:id", async (c) => {
    const id = mediaId.safeParse(c.req.param("id"));
    if (!id.success) throw notFound("Foto no encontrada");
    const size = c.req.query("size") === "thumb" ? "thumb" : "full";
    return serveMedia(c.env, c.get("user"), id.data, size, c.req.raw.headers);
  });
