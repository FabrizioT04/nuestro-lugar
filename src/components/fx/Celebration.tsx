import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { heartSpecs, prefersReducedMotion, seededRandom } from "@/fx/motion";
import { HeartBurst } from "./HeartBurst";

const CONFETTI_COLORS = ["#d42f58", "#ff8aa3", "#ffd166", "#7b5cc8", "#cdc2f7", "#ffffff", "#ffb0c1"];

/**
 * El día del aniversario (o de otra fecha especial): confeti que cae girando, la lluvia de
 * corazones y un cartel con la fecha. Todo se va solo a los pocos segundos.
 */
export function Celebration({ seed = 1, title }: { seed?: number; title: string }) {
  const [visible, setVisible] = useState(() => !prefersReducedMotion());
  const pieces = useMemo(() => {
    const random = seededRandom(seed * 31 + 7);
    return heartSpecs(70, seed + 101, { minSize: 6, maxSize: 12, maxDelay: 1.2, minDuration: 2.6, maxDuration: 3.8 }).map((spec) => ({
      ...spec,
      color: CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)] ?? "#d42f58",
      round: random() < 0.25,
      flip: Math.round(360 + random() * 900),
    }));
  }, [seed]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 5200);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;
  return (
    <>
      <HeartBurst seed={seed} count={18} />
      {createPortal(
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden data-testid="celebration">
          {pieces.map((piece, index) => (
            <span
              key={index}
              className="absolute -top-4 block animate-confetti-fall"
              style={
                {
                  left: `${piece.left}%`,
                  width: piece.size,
                  height: piece.round ? piece.size : piece.size * 0.45,
                  borderRadius: piece.round ? "9999px" : "2px",
                  background: piece.color,
                  animationDelay: `${piece.delay}s`,
                  animationDuration: `${piece.duration}s`,
                  "--drift": `${piece.drift * 1.5}px`,
                  "--spin": `${piece.spin * 6}deg`,
                  "--flip": `${piece.flip}deg`,
                } as CSSProperties
              }
            />
          ))}
          {title && (
            <div className="absolute inset-x-0 top-[56%] flex justify-center px-6">
              <p className="animate-banner-in rounded-3xl bg-ink px-6 py-3 text-center text-white shadow-[0_12px_30px_rgb(20_17_19/0.35)]">
                <span className="block text-xs font-semibold tracking-wide text-white/70 uppercase">¡Hoy es el día! 🎉</span>
                <span className="block text-lg font-bold tracking-tight">{title}</span>
              </p>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
