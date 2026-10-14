import type { HomeCorners } from "@shared/api";
import { daysBetween } from "@shared/dates";
import { Compass, Music } from "lucide-react";
import { MemoryPhoto } from "@/components/memories/MemoryPhoto";
import { drawingUrl } from "@/services/api/drawings";
import { formatCountdown, formatNumber, plural } from "@/utils/format";

/** Lo que dice cada rincón debajo de su nombre cuando no hay novedades. */
export function cornerLine(to: string, corners: HomeCorners, today: string): string {
  switch (to) {
    case "/recuerdos":
      return corners.memories.count > 0 ? plural(corners.memories.count, "recuerdo") : "Guarden el primero";
    case "/cartas":
      return corners.letters.count > 0 ? plural(corners.letters.count, "carta") : "Escríbanse la primera";
    case "/planes":
      if (corners.plans.nextOn) return `Próximo: ${formatCountdown(daysBetween(today, corners.plans.nextOn.slice(0, 10))).toLowerCase()}`;
      return corners.plans.pending > 0 ? plural(corners.plans.pending, "pendiente") : "Planeen algo juntos";
    case "/descubrir":
      return "Ideas para salir";
    case "/futuro":
      return corners.future.count > 0 ? plural(corners.future.count, "cápsula") : "Para abrir después";
    case "/nosotros":
      return corners.us.count > 0 ? plural(corners.us.count, "fecha") : "Sus fechas importantes";
    case "/dibujos":
      return corners.drawings.count > 0 ? plural(corners.drawings.count, "dibujo") : "Dibújense algo";
    case "/canciones": {
      const song = corners.songs.latest;
      if (song?.title) return song.artist ? `${song.title} · ${song.artist}` : song.title;
      return corners.songs.count > 0 ? plural(corners.songs.count, "canción", "canciones") : "Recomiéndense una";
    }
    default:
      return " ";
  }
}

/** ¿El rincón tiene una imagen suya? Entonces el bloque es más alto para que se luzca. */
export function cornerHasArt(to: string, corners: HomeCorners): boolean {
  return (
    (to === "/recuerdos" && corners.memories.photos.length > 0) ||
    (to === "/dibujos" && corners.drawings.latestId !== null) ||
    (to === "/canciones" && corners.songs.latest !== null)
  );
}

/** La imagen que se asoma en el rincón: sus fotos, su último dibujo, la portada de la canción o un número grande. */
export function CornerArt({ to, corners, hasBadge }: { to: string; corners: HomeCorners; hasBadge: boolean }) {
  if (to === "/recuerdos" && corners.memories.photos.length > 0) {
    const photos = corners.memories.photos;
    return (
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-12 flex -translate-y-1/2 items-center">
        {photos.map((photo, index) => (
          <span
            key={photo.id}
            className="-ml-6 block animate-float rounded-xl bg-white p-1.5 pb-4 shadow-soft first:ml-0"
            style={{ "--tilt": `${TILTS[index]}deg`, transform: `rotate(${TILTS[index]}deg)`, zIndex: photos.length - index, animationDelay: `${index * 0.8}s` } as React.CSSProperties}
          >
            <MemoryPhoto photo={photo} className="block h-16 w-16 rounded-lg" />
          </span>
        ))}
      </span>
    );
  }

  if (to === "/dibujos" && corners.drawings.latestId) {
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 bottom-3 block animate-float rounded-xl bg-white p-1.5 shadow-soft"
        style={{ "--tilt": "6deg", transform: "rotate(6deg)" } as React.CSSProperties}
      >
        <img src={drawingUrl(corners.drawings.latestId, "thumb")} alt="" loading="lazy" className="block h-16 w-16 rounded-lg object-contain" />
      </span>
    );
  }

  if (to === "/canciones" && corners.songs.latest) {
    const cover = corners.songs.latest.thumbnailUrl;
    return (
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-12 flex -translate-y-1/2 items-center">
        {/* El disco se asoma detrás de la portada y gira despacito. */}
        <span className="absolute left-8 h-18 w-18 animate-[spin_8s_linear_infinite] rounded-full bg-[radial-gradient(circle,#d42f58_0,#d42f58_14%,#141113_15%,#2a2428_40%,#141113_41%,#2a2428_70%,#141113_71%)] shadow-soft" />
        <span className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-ink text-white shadow-soft">
          {cover ? <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Music size={28} />}
        </span>
      </span>
    );
  }

  if (to === "/descubrir") {
    return (
      <Compass
        aria-hidden
        size={88}
        strokeWidth={1.2}
        className="pointer-events-none absolute -right-4 -bottom-4 animate-[spin_30s_linear_infinite] text-ink/[0.07]"
      />
    );
  }

  // El número grande va arriba a la derecha, donde iría el globito: si hay novedades, manda el globito.
  const count = bigNumber(to, corners);
  if (count === null || count === 0 || hasBadge) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute top-2 right-4 text-6xl leading-none font-extrabold tracking-tighter text-ink/[0.08]">
      {count > 999 ? "999+" : formatNumber(count)}
    </span>
  );
}

const TILTS = [-8, 4, 11];

function bigNumber(to: string, corners: HomeCorners): number | null {
  switch (to) {
    case "/cartas":
      return corners.letters.count;
    case "/planes":
      return corners.plans.pending;
    case "/futuro":
      return corners.future.count;
    case "/nosotros":
      return corners.us.count;
    case "/dibujos":
      return corners.drawings.count;
    case "/canciones":
      return corners.songs.count;
    case "/recuerdos":
      return corners.memories.count;
    default:
      return null;
  }
}
