import { Link } from "react-router";
import { Heart, Images, MapPin } from "lucide-react";
import type { MemorySummary } from "@shared/api";
import { formatLongDate } from "@/utils/format";
import { MemoryPhoto } from "./MemoryPhoto";

/** Foto con pie limpio; la ficha conserva la imagen completa y sus detalles. */
export function MemoryCard({ memory }: { memory: MemorySummary }) {
  const cover = memory.cover;

  return (
    <Link
      to={`/recuerdos/${memory.id}`}
      className="block h-full overflow-hidden rounded-card border border-blush-200 bg-paper transition hover:border-blush-300 active:scale-[0.99]"
    >
      <div className="relative">
        <MemoryPhoto photo={cover} className="aspect-[16/10] w-full" />
        <div className="absolute top-2.5 right-2.5 flex gap-1.5">
          {memory.photoCount > 1 && (
            <span className="flex items-center gap-1 rounded-full bg-paper/85 px-2 py-1 text-[11px] font-bold backdrop-blur">
              <Images size={12} aria-hidden /> {memory.photoCount}
            </span>
          )}
          {memory.isFavorite && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper/85 text-blush-500 backdrop-blur">
              <Heart size={14} fill="currentColor" aria-label="Favorito" />
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        <p className="text-base leading-snug font-medium break-words text-ink">{memory.title}</p>
        <p className="mt-0.5 text-[11px] text-ink-soft">{formatLongDate(memory.happenedOn)}</p>
        {memory.placeName && (
          <p className="flex items-center gap-1 text-[11px] text-ink-soft">
            <MapPin size={11} className="shrink-0" aria-hidden />
            <span className="truncate">{memory.placeName}</span>
          </p>
        )}
        {memory.category && (
          <span className="mt-2 inline-block rounded-lg bg-blush-50 px-2 py-1 text-[11px] font-medium text-blush-700">
            {memory.category}
          </span>
        )}
      </div>
    </Link>
  );
}
