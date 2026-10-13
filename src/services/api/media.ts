import type { PhotoRef, UploadedAudio, UploadedMedia } from "@shared/api";
import type { PreparedImage } from "@/utils/image";
import { actionHeader, apiFetch, mediaSrc } from "./client";

export type PhotoPurpose = "memory" | "plan" | "cover" | "capsule";

export const mediaApi = {
  /** `clientActionId` hace que reintentar la misma subida no cree una foto repetida. */
  upload(image: PreparedImage, purpose: PhotoPurpose = "memory", clientActionId?: string) {
    const form = new FormData();
    const ext = (blob: Blob) => (blob.type === "image/webp" ? "webp" : "jpg");
    form.append("file", image.full, `foto.${ext(image.full)}`);
    form.append("thumb", image.thumb, `miniatura.${ext(image.thumb)}`);
    form.append("width", String(image.width));
    form.append("height", String(image.height));
    form.append("purpose", purpose);
    return apiFetch<UploadedMedia>("/media", { method: "POST", body: form, headers: actionHeader(clientActionId) });
  },

  /** Audio para una cápsula del futuro (grabado en el navegador o elegido de los archivos). */
  uploadAudio(audio: Blob, durationMs: number | null) {
    const form = new FormData();
    form.append("file", audio, "audio");
    if (durationMs) form.append("durationMs", String(Math.round(durationMs)));
    return apiFetch<UploadedAudio>("/media/audio", { method: "POST", body: form });
  },
};

/** URL de una foto servida por el Worker (el Worker comprueba la sesión en cada petición). */
export function photoUrl(photo: Pick<PhotoRef, "id"> | string, size: "full" | "thumb" = "full"): string {
  const id = typeof photo === "string" ? photo : photo.id;
  return mediaSrc(`/media/${id}${size === "thumb" ? "?size=thumb" : ""}`);
}
