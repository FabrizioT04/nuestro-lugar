import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { PhotoRef } from "@shared/api";
import { prefersReducedMotion } from "@/fx/motion";
import { photoUrl } from "@/services/api/media";

const DURATION = 300;

/**
 * Foto en grande: crece desde la miniatura que se tocó (como en Instagram) y vuelve a ella al cerrar.
 * Se cierra tocando fuera, con la X o con Escape.
 */
export function PhotoLightbox({ photo, origin, alt, onClose }: { photo: PhotoRef; origin: DOMRect | null; alt: string; onClose: () => void }) {
  const image = useRef<HTMLImageElement>(null);
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState<string | null>(null);
  const closing = useRef(false);

  // Mide dónde quedará la foto y la pone primero encima de la miniatura.
  useLayoutEffect(() => {
    const final = image.current?.getBoundingClientRect();
    if (origin && final && final.width > 0 && !prefersReducedMotion()) {
      const scale = origin.width / final.width;
      const dx = origin.left + origin.width / 2 - (final.left + final.width / 2);
      const dy = origin.top + origin.height / 2 - (final.top + final.height / 2);
      setOffset(`translate(${dx}px, ${dy}px) scale(${scale})`);
    }
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    return () => cancelAnimationFrame(frame);
  }, [origin]);

  function close() {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    setTimeout(onClose, prefersReducedMotion() ? 0 : DURATION);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-50 flex items-center justify-center p-3" onClick={close} data-testid="photo-lightbox">
      <div aria-hidden className="absolute inset-0 bg-black transition-opacity duration-300" style={{ opacity: open ? 0.92 : 0 }} />
      <img
        ref={image}
        src={photoUrl(photo, "full")}
        alt={alt}
        width={photo.width ?? undefined}
        height={photo.height ?? undefined}
        className="relative h-auto max-h-[88dvh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
        style={{
          transform: open || !offset ? "none" : offset,
          transition: `transform ${DURATION}ms cubic-bezier(0.22, 1, 0.36, 1), border-radius ${DURATION}ms`,
        }}
      />
      <button
        type="button"
        aria-label="Cerrar foto"
        onClick={close}
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-opacity duration-300"
        style={{ opacity: open ? 1 : 0 }}
      >
        <X size={22} aria-hidden />
      </button>
    </div>,
    document.body,
  );
}
