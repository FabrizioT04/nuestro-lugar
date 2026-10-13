import type { UploadedAudio, UploadedMedia } from "@shared/api";
import type { AuthenticatedUser } from "../auth/types";
import type { Bindings } from "../env";
import { createMediaRepository } from "../repositories/mediaRepository";
import { badRequest, notFound, payloadTooLarge, rateLimited, unsupportedMediaType } from "../utils/errors";
import {
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  MAX_AUDIO_BYTES,
  MAX_PHOTO_BYTES,
  MAX_THUMB_BYTES,
  mediaObjectKey,
  parseDimension,
  parseDurationMs,
  sniffAudioType,
  sniffImageType,
  type ImageMime,
} from "../utils/media";

// Las fotos de cápsulas se suben igual, pero solo se sirven por /api/capsules (que comprueba la fecha).
const UPLOAD_PURPOSES = ["memory", "plan", "cover", "capsule"] as const;
type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export async function readImage(entry: string | File | null, maxBytes: number, label: string) {
  if (!(entry instanceof File)) throw badRequest(`Falta ${label}`);
  if (entry.size === 0) throw badRequest(`${label} está vacía`);
  if (entry.size > maxBytes) throw payloadTooLarge(`${label} supera ${Math.round(maxBytes / 1024 / 1024)} MB`);
  const bytes = new Uint8Array(await entry.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) throw unsupportedMediaType("Solo se aceptan fotos JPG, PNG o WebP");
  return { bytes, type };
}

/**
 * Sube una foto (y su miniatura) a R2 y la registra en D1.
 * El cliente envía multipart/form-data con: file, thumb, width, height y purpose.
 */
export async function uploadPhoto(env: Bindings, user: AuthenticatedUser, form: FormData): Promise<UploadedMedia> {
  const relationshipId = user.relationshipId!;

  const { success } = await env.UPLOAD_LIMITER.limit({ key: user.id });
  if (!success) throw rateLimited("Demasiadas fotos seguidas. Espera un minuto.");

  const purpose = form.get("purpose") ?? "memory";
  if (!UPLOAD_PURPOSES.includes(purpose as UploadPurpose)) throw badRequest("Propósito de archivo inválido");

  const photo = await readImage(form.get("file"), MAX_PHOTO_BYTES, "La foto");
  const thumb = form.has("thumb") ? await readImage(form.get("thumb"), MAX_THUMB_BYTES, "La miniatura") : null;

  const id = crypto.randomUUID();
  const key = mediaObjectKey(relationshipId, purpose as string, id, IMAGE_EXTENSIONS[photo.type]);
  const thumbKey = thumb
    ? mediaObjectKey(relationshipId, purpose as string, id, IMAGE_EXTENSIONS[thumb.type], "thumb")
    : null;

  const put = (objectKey: string, bytes: Uint8Array, contentType: ImageMime) =>
    env.MEDIA.put(objectKey, bytes, {
      httpMetadata: { contentType, cacheControl: "private, max-age=31536000, immutable" },
      customMetadata: { relationshipId, uploadedBy: user.id },
    });

  await Promise.all([put(key, photo.bytes, photo.type), thumb && thumbKey ? put(thumbKey, thumb.bytes, thumb.type) : null]);

  const width = parseDimension(form.get("width"));
  const height = parseDimension(form.get("height"));
  try {
    await createMediaRepository(env.DB).insert({
      id,
      relationshipId,
      uploadedBy: user.id,
      r2Key: key,
      thumbR2Key: thumbKey,
      purpose: purpose as UploadPurpose,
      contentType: photo.type,
      sizeBytes: photo.bytes.byteLength,
      thumbSizeBytes: thumb?.bytes.byteLength ?? null,
      width,
      height,
      durationMs: null,
    });
  } catch (err) {
    // Sin registro en D1 el archivo quedaría huérfano en R2.
    await env.MEDIA.delete([key, ...(thumbKey ? [thumbKey] : [])]);
    throw err;
  }

  return { id, width, height, sizeBytes: photo.bytes.byteLength };
}

/**
 * Sube un audio para una cápsula del futuro. El cliente envía multipart/form-data con
 * file y, opcionalmente, durationMs (la duración que midió el navegador).
 */
export async function uploadAudio(env: Bindings, user: AuthenticatedUser, form: FormData): Promise<UploadedAudio> {
  const relationshipId = user.relationshipId!;

  const { success } = await env.UPLOAD_LIMITER.limit({ key: user.id });
  if (!success) throw rateLimited("Demasiados archivos seguidos. Espera un minuto.");

  const entry = form.get("file");
  if (!(entry instanceof File)) throw badRequest("Falta el audio");
  if (entry.size === 0) throw badRequest("El audio está vacío");
  if (entry.size > MAX_AUDIO_BYTES) throw payloadTooLarge(`El audio supera ${MAX_AUDIO_BYTES / 1024 / 1024} MB`);
  const bytes = new Uint8Array(await entry.arrayBuffer());
  const type = sniffAudioType(bytes);
  if (!type) throw unsupportedMediaType("Solo se aceptan audios WebM, OGG, M4A, MP3 o WAV");

  const id = crypto.randomUUID();
  const key = mediaObjectKey(relationshipId, "capsule", id, AUDIO_EXTENSIONS[type]);
  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType: type, cacheControl: "private, max-age=3600" },
    customMetadata: { relationshipId, uploadedBy: user.id },
  });

  const durationMs = parseDurationMs(form.get("durationMs"));
  try {
    await createMediaRepository(env.DB).insert({
      id,
      relationshipId,
      uploadedBy: user.id,
      r2Key: key,
      thumbR2Key: null,
      purpose: "capsule",
      contentType: type,
      sizeBytes: bytes.byteLength,
      thumbSizeBytes: null,
      width: null,
      height: null,
      durationMs,
    });
  } catch (err) {
    await env.MEDIA.delete(key);
    throw err;
  }

  return { id, durationMs, sizeBytes: bytes.byteLength };
}

/**
 * Envía un objeto de R2 al navegador. Soporta caché (If-None-Match) y rangos (Range),
 * que Safari exige para reproducir audios.
 */
export async function serveR2Object(env: Bindings, key: string, requestHeaders: Headers, cacheControl: string): Promise<Response> {
  let object: R2Object | R2ObjectBody | null;
  try {
    object = await env.MEDIA.get(key, { onlyIf: requestHeaders, range: requestHeaders });
  } catch (err) {
    // Rango imposible (por ejemplo, más allá del final del archivo).
    if (requestHeaders.has("range")) return new Response(null, { status: 416 });
    throw err;
  }
  if (!object) throw notFound("Archivo no encontrado");

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", cacheControl);
  headers.set("content-disposition", "inline");
  headers.set("accept-ranges", "bytes");

  // Sin cuerpo = el navegador ya tiene esta versión (If-None-Match).
  if (!("body" in object)) return new Response(null, { status: 304, headers });

  const range = object.range as { offset?: number; length?: number } | undefined;
  if (requestHeaders.has("range") && range) {
    const offset = range.offset ?? 0;
    const length = range.length ?? object.size - offset;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    return new Response(object.body, { status: 206, headers });
  }
  return new Response(object.body, { headers });
}

/** Devuelve la foto (o su miniatura) solo si pertenece a la relación del usuario. */
export async function serveMedia(
  env: Bindings,
  user: AuthenticatedUser,
  mediaId: string,
  size: "full" | "thumb",
  requestHeaders: Headers,
): Promise<Response> {
  const media = await createMediaRepository(env.DB).findInRelationship(mediaId, user.relationshipId!);
  // Las cápsulas del futuro se sirven por su propia ruta, que comprueba la fecha.
  if (!media || media.purpose === "capsule") throw notFound("Foto no encontrada");

  const key = size === "thumb" && media.thumb_r2_key ? media.thumb_r2_key : media.r2_key;
  return serveR2Object(env, key, requestHeaders, "private, max-age=31536000, immutable");
}
