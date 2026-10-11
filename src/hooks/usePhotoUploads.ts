import { useCallback, useState } from "react";
import type { PhotoItem } from "@/components/memories/PhotoUploader";
import { mediaApi } from "@/services/api/media";
import { prepareImage } from "@/utils/image";

/** Lista de fotos de un formulario: comprime y sube cada foto nueva (una a la vez). */
export function usePhotoUploads(purpose: "memory" | "plan") {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

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
        try {
          const prepared = await prepareImage(files[index]!);
          patchPhoto(item.key, { status: "uploading" });
          const uploaded = await mediaApi.upload(prepared, purpose);
          patchPhoto(item.key, { status: "done", mediaId: uploaded.id });
        } catch (err) {
          patchPhoto(item.key, { status: "error", error: err instanceof Error ? err.message : "No se pudo subir" });
        }
      }
    })();
  }

  /** Carga las fotos ya guardadas (al editar). */
  const setSaved = useCallback(
    (ids: string[]) => setPhotos(ids.map((id) => ({ key: id, status: "done", mediaId: id }))),
    [],
  );

  return {
    photos,
    setSaved,
    addPhotos,
    remove: (key: string) => setPhotos((list) => list.filter((p) => p.key !== key)),
    makeCover: (key: string) =>
      setPhotos((list) => {
        const chosen = list.find((p) => p.key === key);
        return chosen ? [chosen, ...list.filter((p) => p.key !== key)] : list;
      }),
    /** Ids de las fotos ya subidas, en orden. */
    uploadedIds: photos.filter((p) => p.status === "done" && p.mediaId).map((p) => p.mediaId!),
    busy: photos.some((p) => p.status === "processing" || p.status === "uploading"),
  };
}
