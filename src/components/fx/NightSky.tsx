import { useMemo, type CSSProperties } from "react";
import { seededRandom } from "@/fx/motion";

/** Estrellitas que titilan sobre la foto de Inicio cuando es de noche donde viven. */
export function NightSky({ count = 26 }: { count?: number }) {
  const stars = useMemo(() => {
    const random = seededRandom(42);
    return Array.from({ length: count }, () => ({
      left: random() * 100,
      top: random() * 55,
      size: 1.5 + random() * 2.5,
      delay: random() * 3,
      duration: 2 + random() * 3,
    }));
  }, [count]);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden data-testid="night-sky">
      <div className="absolute inset-0 bg-gradient-to-b from-[#1b1440]/70 via-[#1b1440]/25 to-transparent" />
      {stars.map((star, index) => (
        <span
          key={index}
          className="absolute block animate-twinkle rounded-full bg-white shadow-[0_0_6px_rgb(255_255_255/0.9)]"
          style={{ left: `${star.left}%`, top: `${star.top}%`, width: star.size, height: star.size, animationDelay: `${star.delay}s`, animationDuration: `${star.duration}s` } as CSSProperties}
        />
      ))}
    </div>
  );
}
