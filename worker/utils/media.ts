// Validación de archivos subidos. El tipo se decide por los primeros bytes del archivo
// ("magic bytes"), no por el nombre ni por el Content-Type que manda el cliente.

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

export const IMAGE_EXTENSIONS: Record<ImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_THUMB_BYTES = 1024 * 1024;
/** Límite de la petición completa (foto + miniatura + campos). */
export const MAX_UPLOAD_REQUEST_BYTES = MAX_PHOTO_BYTES + MAX_THUMB_BYTES + 64 * 1024;

export function sniffImageType(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/**
 * Clave del objeto en R2. Solo contiene ids generados por el servidor: el nombre original
 * del archivo nunca se usa (evita rutas raras, datos personales en el nombre y colisiones).
 */
export function mediaObjectKey(relationshipId: string, purpose: string, mediaId: string, ext: string, variant?: "thumb") {
  return `${relationshipId}/${purpose}/${mediaId}${variant ? `_${variant}` : ""}.${ext}`;
}

/** Entero positivo razonable para dimensiones de imagen, o null. */
export function parseDimension(value: string | File | null): number | null {
  if (typeof value !== "string" || !/^\d{1,5}$/.test(value)) return null;
  const n = Number(value);
  return n > 0 && n <= 20_000 ? n : null;
}

// ---------------------------------------------------------------------------
// Audios (cápsulas del futuro)
// ---------------------------------------------------------------------------

export type AudioMime = "audio/webm" | "audio/ogg" | "audio/mp4" | "audio/mpeg" | "audio/wav";

export const AUDIO_EXTENSIONS: Record<AudioMime, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_REQUEST_BYTES = MAX_AUDIO_BYTES + 64 * 1024;
/** Duración máxima aceptada (la informa el navegador; solo se usa para mostrarla). */
export const MAX_AUDIO_DURATION_MS = 10 * 60 * 1000;

/**
 * Tipo de audio por sus primeros bytes. Cubre lo que graban los navegadores
 * (WebM/Opus en Chrome y Android, MP4/AAC en Safari e iOS) y los archivos más comunes.
 */
export function sniffAudioType(bytes: Uint8Array): AudioMime | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "audio/webm";
  if (bytes.length >= 4 && ascii(0, 4) === "OggS") return "audio/ogg";
  if (bytes.length >= 12 && ascii(4, 8) === "ftyp") return "audio/mp4";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "audio/wav";
  if (bytes.length >= 3 && ascii(0, 3) === "ID3") return "audio/mpeg";
  // Cabecera de trama MPEG sin etiqueta ID3 (11 bits de sincronización + capa III).
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe6) === 0xe2) return "audio/mpeg";
  return null;
}

/** Duración en milisegundos dentro de un rango razonable, o null. */
export function parseDurationMs(value: string | File | null): number | null {
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value)) return null;
  const n = Number(value);
  return n > 0 && n <= MAX_AUDIO_DURATION_MS ? n : null;
}
