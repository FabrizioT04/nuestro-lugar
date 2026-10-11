import { useRef } from "react";
import { AlertCircle, ImagePlus, Loader2, Star, X } from "lucide-react";
import { MAX_PHOTOS_PER_MEMORY } from "@shared/schemas";
import { photoUrl } from "@/services/api/media";

export interface PhotoItem {
  /** Clave local estable para React. */
  key: string;
  status: "processing" | "uploading" | "done" | "error";
  mediaId?: string;
  /** URL local (blob:) mientras se sube; luego se usa la del servidor. */
  previewUrl?: string;
  error?: string;
}

interface Props {
  photos: PhotoItem[];
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
  onMakeCover: (key: string) => void;
  /** Máximo de fotos (por defecto, el de los recuerdos). */
  max?: number;
  /** URL de la miniatura de una foto ya guardada (las de cápsulas se sirven por otra ruta). */
  thumbUrl?: (mediaId: string) => string;
  hint?: string;
}

const defaultThumbUrl = (mediaId: string) => photoUrl(mediaId, "thumb");

export function PhotoUploader({ photos, onAdd, onRemove, onMakeCover, max = MAX_PHOTOS_PER_MEMORY, thumbUrl = defaultThumbUrl, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = max - photos.length;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, index) => (
          <div key={photo.key} className="relative aspect-square overflow-hidden rounded-2xl bg-blush-50">
            {(photo.previewUrl || photo.mediaId) && (
              <img
                src={photo.previewUrl ?? thumbUrl(photo.mediaId!)}
                alt=""
                className={`h-full w-full object-cover ${photo.status === "done" ? "" : "opacity-60"}`}
              />
            )}
            {(photo.status === "processing" || photo.status === "uploading") && (
              <span className="absolute inset-0 flex items-center justify-center text-blush-700">
                <Loader2 size={24} className="animate-spin" aria-label="Subiendo" />
              </span>
            )}
            {photo.status === "error" && (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-paper/80 p-2 text-center text-[11px] font-semibold text-blush-700">
                <AlertCircle size={18} aria-hidden />
                {photo.error ?? "Error"}
              </span>
            )}
            {index === 0 && photo.status === "done" && (
              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-paper/90 px-2 py-0.5 text-[10px] font-bold text-blush-700">Portada</span>
            )}
            <div className="absolute top-1.5 right-1.5 flex gap-1">
              {index > 0 && photo.status === "done" && (
                <button
                  type="button"
                  onClick={() => onMakeCover(photo.key)}
                  aria-label="Usar como portada"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-paper/90 text-ink"
                >
                  <Star size={14} aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(photo.key)}
                aria-label="Quitar foto"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-paper/90 text-ink"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          </div>
        ))}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-blush-200 text-sm font-semibold text-blush-700 transition hover:bg-blush-50"
          >
            <ImagePlus size={24} strokeWidth={1.75} aria-hidden />
            Añadir
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []).slice(0, remaining);
          event.target.value = "";
          if (files.length > 0) onAdd(files);
        }}
      />
      <p className="mt-2 text-xs text-ink-soft">
        {hint ?? `Se comprimen antes de subir y se les quita la ubicación GPS. Hasta ${max} fotos.`}
      </p>
    </div>
  );
}
