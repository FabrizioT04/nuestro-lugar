import type { PhotoRef, UploadedMedia } from "@shared/api";
import type { PreparedImage } from "@/utils/image";
import { apiFetch } from "./client";

export const mediaApi = {
  upload(image: PreparedImage, purpose: "memory" | "plan" | "cover" = "memory") {
    const form = new FormData();
    const ext = (blob: Blob) => (blob.type === "image/webp" ? "webp" : "jpg");
    form.append("file", image.full, `foto.${ext(image.full)}`);
    form.append("thumb", image.thumb, `miniatura.${ext(image.thumb)}`);
    form.append("width", String(image.width));
    form.append("height", String(image.height));
    form.append("purpose", purpose);
    return apiFetch<UploadedMedia>("/media", { method: "POST", body: form });
  },
};

/** URL de una foto servida por el Worker (misma sesión, mismo dominio). */
export function photoUrl(photo: Pick<PhotoRef, "id"> | string, size: "full" | "thumb" = "full"): string {
  const id = typeof photo === "string" ? photo : photo.id;
  return `/api/media/${id}${size === "thumb" ? "?size=thumb" : ""}`;
}
