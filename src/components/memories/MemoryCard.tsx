import { Link } from "react-router";
import { Heart, Images, MapPin } from "lucide-react";
import type { MemorySummary } from "@shared/api";
import { formatLongDate } from "@/utils/format";
import { MemoryPhoto } from "./MemoryPhoto";

/** Tarjeta compacta para el mosaico de dos columnas: la foto manda y el texto va debajo. */
export function MemoryCard({ memory }: { memory: MemorySummary }) {
  const cover = memory.cover;
  // Respeta la proporción real de la foto (vertical u horizontal) dentro de un rango razonable.
  const ratio = cover?.width && cover.height ? Math.min(Math.max(cover.width / cover.height, 0.7), 1.4) : 0.85;

  return (
    <Link
      to={`/recuerdos/${memory.id}`}
      className="block overflow-hidden rounded-[1.4rem] border border-blush-100/80 bg-paper shadow-soft transition active:scale-[0.98]"
    >
      <div className="relative">
        <MemoryPhoto photo={cover} className="w-full rounded-t-[1.15rem]" style={{ aspectRatio: ratio }} />
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
      <div className="px-3 pt-2.5 pb-3">
        <p className="text-sm leading-snug font-bold text-ink">{memory.title}</p>
        <p className="mt-0.5 text-[11px] text-ink-soft">{formatLongDate(memory.happenedOn)}</p>
        {memory.placeName && (
          <p className="flex items-center gap-1 text-[11px] text-ink-soft">
            <MapPin size={11} className="shrink-0" aria-hidden />
            <span className="truncate">{memory.placeName}</span>
          </p>
        )}
        {memory.category && (
          <span className="mt-1.5 inline-block rounded-full bg-lavender-100 px-2 py-0.5 text-[11px] font-bold text-lavender-500">
            {memory.category}
          </span>
        )}
      </div>
    </Link>
  );
}
