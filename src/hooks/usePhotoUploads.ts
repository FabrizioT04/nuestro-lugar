import { useCallback, useRef, useState } from "react";
import type { PhotoItem } from "@/components/memories/PhotoUploader";
import { saveLocalPhoto } from "@/offline/outbox";
import type { PhotoSlot } from "@/offline/types";
import { ApiError } from "@/services/api/client";
import { mediaApi, type PhotoPurpose } from "@/services/api/media";
import { prepareImage, type PreparedImage } from "@/utils/image";

const isOffline = (err: unknown) => !navigator.onLine || (err instanceof ApiError && err.code === "network_error");

/**
 * Lista de fotos de un formulario: comprime y sube cada foto nueva (una a la vez).
 * Sin conexión, la foto ya comprimida se queda en el dispositivo (estado "local") y se sube
 * cuando el recuerdo o el plan se sincronice.
 */
export function usePhotoUploads(purpose: Exclude<PhotoPurpose, "cover">) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const prepared = useRef(new Map<string, PreparedImage>());

  const patchPhoto = (key: string, patch: Partial<PhotoItem>) =>
    setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  function addPhotos(files: File[]) {
    const items: PhotoItem[] = files.map((file) => ({
      key: crypto.randomUUID(),
      status: "processing",
      previewUrl: URL.createObjectURL(file),
    }));
    setPhotos((list) => [...list, ...items]);

    // Una a la vez: menos memoria en el móvil y no se dispara el límite de subidas.
    void (async () => {
      for (const [index, item] of items.entries()) {
        let image: PreparedImage;
        try {
          image = await prepareImage(files[index]!);
        } catch (err) {
          patchPhoto(item.key, { status: "error", error: err instanceof Error ? err.message : "No se pudo abrir" });
          continue;
        }
        try {
          if (!navigator.onLine) throw new ApiError(0, "network_error", "Sin conexión");
          patchPhoto(item.key, { status: "uploading" });
          const uploaded = await mediaApi.upload(image, purpose);
          patchPhoto(item.key, { status: "done", mediaId: uploaded.id });
        } catch (err) {
          if (isOffline(err)) {
            prepared.current.set(item.key, image);
            patchPhoto(item.key, { status: "local" });
          } else {
            patchPhoto(item.key, { status: "error", error: err instanceof Error ? err.message : "No se pudo subir" });
          }
        }
      }
    })();
  }

  /** Carga las fotos ya guardadas (al editar). */
  const setSaved = useCallback(
    (ids: string[]) => setPhotos(ids.map((id) => ({ key: id, status: "done", mediaId: id }))),
    [],
  );

  /** Fotos listas para guardar, en orden: las subidas por su id y las locales guardadas en el dispositivo. */
  async function toSlots(): Promise<PhotoSlot[]> {
    const slots: PhotoSlot[] = [];
    for (const photo of photos) {
      if (photo.status === "done" && photo.mediaId) slots.push({ mediaId: photo.mediaId });
      const image = prepared.current.get(photo.key);
      if (photo.status === "local" && image) slots.push({ localPhotoId: await saveLocalPhoto(image) });
    }
    return slots;
  }

  return {
    photos,
    setSaved,
    addPhotos,
    toSlots,
    remove: (key: string) => {
      prepared.current.delete(key);
      setPhotos((list) => list.filter((p) => p.key !== key));
    },
    makeCover: (key: string) =>
      setPhotos((list) => {
        const chosen = list.find((p) => p.key === key);
        return chosen ? [chosen, ...list.filter((p) => p.key !== key)] : list;
      }),
    /** Ids de las fotos ya subidas, en orden. */
    uploadedIds: photos.filter((p) => p.status === "done" && p.mediaId).map((p) => p.mediaId!),
    /** Hay fotos que se subirán más tarde (solo vale para crear, no para editar). */
    hasLocal: photos.some((p) => p.status === "local"),
    busy: photos.some((p) => p.status === "processing" || p.status === "uploading"),
  };
}
