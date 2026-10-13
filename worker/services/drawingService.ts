import type { Drawing, DrawingListResponse } from "@shared/api";
import { drawingCaptionSchema } from "@shared/schemas";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createDrawingRepository, type DrawingRow } from "../repositories/drawingRepository";
import { badRequest, forbidden, notFound, rateLimited } from "../utils/errors";
import { IMAGE_EXTENSIONS, MAX_PHOTO_BYTES, MAX_THUMB_BYTES, mediaObjectKey, parseDimension } from "../utils/media";
import { readImage, serveR2Object } from "./mediaService";

// Fotos de dibujos que uno le deja al otro. Se guardan aparte de las fotos de recuerdos
// y solo se sirven por /api/drawings, que comprueba que sean de la misma pareja.

const LIST_LIMIT = 200;

export function toDrawing(row: DrawingRow, viewerId: string): Drawing {
  return {
    id: row.id,
    caption: row.caption,
    width: row.width,
    height: row.height,
    author: { id: row.author_id, displayName: row.author_name },
    isMine: row.author_id === viewerId,
    createdAt: row.created_at,
  };
}

export async function listDrawings(env: Bindings, user: AuthenticatedUser): Promise<DrawingListResponse> {
  const rows = await createDrawingRepository(env.DB).list(user.relationshipId!, LIST_LIMIT);
  return { items: rows.map((row) => toDrawing(row, user.id)) };
}

/** multipart/form-data con: file, thumb, width, height y caption (opcional). */
export async function createDrawing(env: Bindings, user: AuthenticatedUser, form: FormData): Promise<Drawing> {
  const relationshipId = user.relationshipId!;
  const { success } = await env.UPLOAD_LIMITER.limit({ key: user.id });
  if (!success) throw rateLimited("Demasiadas fotos seguidas. Espera un minuto.");

  const caption = drawingCaptionSchema.safeParse(form.get("caption") ?? "");
  if (!caption.success) throw badRequest(caption.error.issues[0]?.message ?? "Texto inválido");
  const photo = await readImage(form.get("file"), MAX_PHOTO_BYTES, "La foto");
  const thumb = form.has("thumb") ? await readImage(form.get("thumb"), MAX_THUMB_BYTES, "La miniatura") : null;

  const id = crypto.randomUUID();
  const key = mediaObjectKey(relationshipId, "drawing", id, IMAGE_EXTENSIONS[photo.type]);
  const thumbKey = thumb ? mediaObjectKey(relationshipId, "drawing", id, IMAGE_EXTENSIONS[thumb.type], "thumb") : null;
  const put = (objectKey: string, bytes: Uint8Array, contentType: string) =>
    env.MEDIA.put(objectKey, bytes, {
      httpMetadata: { contentType, cacheControl: "private, max-age=31536000, immutable" },
      customMetadata: { relationshipId, uploadedBy: user.id },
    });
  await Promise.all([put(key, photo.bytes, photo.type), thumb && thumbKey ? put(thumbKey, thumb.bytes, thumb.type) : null]);

  const repository = createDrawingRepository(env.DB);
  try {
    await repository.insert({
      id,
      relationshipId,
      authorId: user.id,
      r2Key: key,
      thumbR2Key: thumbKey,
      contentType: photo.type,
      sizeBytes: photo.bytes.byteLength,
      width: parseDimension(form.get("width")),
      height: parseDimension(form.get("height")),
      caption: caption.data,
    });
  } catch (err) {
    // Sin registro en D1 el archivo quedaría huérfano en R2.
    await env.MEDIA.delete([key, ...(thumbKey ? [thumbKey] : [])]);
    throw err;
  }
  const row = await repository.find(relationshipId, id);
  if (!row) throw notFound("Dibujo no encontrado");
  return toDrawing(row, user.id);
}

export async function serveDrawing(
  env: Bindings,
  user: AuthenticatedUser,
  id: string,
  size: "full" | "thumb",
  requestHeaders: Headers,
): Promise<Response> {
  const keys = await createDrawingRepository(env.DB).findKeys(user.relationshipId!, id);
  if (!keys) throw notFound("Dibujo no encontrado");
  const key = size === "thumb" && keys.thumb_r2_key ? keys.thumb_r2_key : keys.r2_key;
  return serveR2Object(env, key, requestHeaders, "private, max-age=31536000, immutable");
}

/** Solo quien lo subió puede borrarlo. */
export async function deleteDrawing(env: Bindings, user: AuthenticatedUser, id: string): Promise<void> {
  const repository = createDrawingRepository(env.DB);
  const keys = await repository.findKeys(user.relationshipId!, id);
  if (!keys) throw notFound("Dibujo no encontrado");
  if (keys.author_id !== user.id) throw forbidden("Solo quien lo subió puede borrarlo");
  await repository.softDelete(user.relationshipId!, id, new Date().toISOString());
  await env.MEDIA.delete([keys.r2_key, ...(keys.thumb_r2_key ? [keys.thumb_r2_key] : [])]);
}
