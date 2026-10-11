import { Link } from "react-router";
import { Heart, Images, MapPin } from "lucide-react";
import type { MemorySummary } from "@shared/api";
import { formatLongDate } from "@/utils/format";
import { MemoryPhoto } from "./MemoryPhoto";

export function MemoryCard({ memory }: { memory: MemorySummary }) {
  return (
    <Link
      to={`/recuerdos/${memory.id}`}
      className="block overflow-hidden rounded-card bg-paper shadow-soft transition active:scale-[0.99]"
    >
      <div className="relative">
        <MemoryPhoto photo={memory.cover} className="aspect-[4/3] w-full" />
        <div className="absolute top-3 right-3 flex gap-1.5">
          {memory.photoCount > 1 && (
            <span className="flex items-center gap-1 rounded-full bg-paper/85 px-2.5 py-1 text-xs font-semibold backdrop-blur">
              <Images size={13} aria-hidden /> {memory.photoCount}
            </span>
          )}
          {memory.isFavorite && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper/85 text-blush-500 backdrop-blur">
              <Heart size={15} fill="currentColor" aria-label="Favorito" />
            </span>
          )}
        </div>
      </div>
      <div className="px-4 pt-3 pb-4">
        <p className="font-display text-lg leading-snug">{memory.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
          <span>{formatLongDate(memory.happenedOn)}</span>
          {memory.placeName && (
            <span className="flex items-center gap-1">
              <MapPin size={13} aria-hidden />
              {memory.placeName}
            </span>
          )}
        </p>
        {memory.category && (
          <span className="mt-2 inline-block rounded-full bg-lavender-100 px-2.5 py-0.5 text-xs font-semibold text-lavender-500">
            {memory.category}
          </span>
        )}
      </div>
    </Link>
  );
}
