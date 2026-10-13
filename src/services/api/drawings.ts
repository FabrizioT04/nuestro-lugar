import type { Drawing, DrawingListResponse } from "@shared/api";
import type { PreparedImage } from "@/utils/image";
import { apiFetch, mediaSrc } from "./client";

export const drawingsApi = {
  list: () => apiFetch<DrawingListResponse>("/drawings"),
  upload(image: PreparedImage, caption: string) {
    const form = new FormData();
    const ext = (blob: Blob) => (blob.type === "image/webp" ? "webp" : "jpg");
    form.append("file", image.full, `dibujo.${ext(image.full)}`);
    form.append("thumb", image.thumb, `miniatura.${ext(image.thumb)}`);
    form.append("width", String(image.width));
    form.append("height", String(image.height));
    form.append("caption", caption);
    return apiFetch<Drawing>("/drawings", { method: "POST", body: form });
  },
  remove: (id: string) => apiFetch<null>(`/drawings/${id}`, { method: "DELETE" }),
};

/** URL de la foto de un dibujo (el Worker comprueba la sesión en cada petición). */
export function drawingUrl(id: string, size: "full" | "thumb" = "full"): string {
  return mediaSrc(`/drawings/${id}/image${size === "thumb" ? "?size=thumb" : ""}`);
}
