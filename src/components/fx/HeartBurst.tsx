import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { heartSpecs, prefersReducedMotion } from "@/fx/motion";

const HEART_PATH = "M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.2 4.5 7 4.5c2 0 3.6 1.1 5 2.8 1.4-1.7 3-2.8 5-2.8 3.8 0 5.9 3.8 4.5 7.2C19.5 16.4 12 21 12 21z";

export function Heart({ color, className = "", style }: { color: string; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      <path d={HEART_PATH} fill={color} />
    </svg>
  );
}

/**
 * Lluvia de corazones pastel que cae sobre toda la pantalla una sola vez y desaparece.
 * Para momentos especiales: abrir una carta, una cápsula o el día del aniversario.
 */
export function HeartBurst({ seed = 1, count = 26 }: { seed?: number; count?: number }) {
  const [visible, setVisible] = useState(() => !prefersReducedMotion());
  const hearts = useMemo(() => heartSpecs(count, seed, { minSize: 14, maxSize: 34, maxDelay: 0.9, minDuration: 2.4, maxDuration: 3.6 }), [count, seed]);

  useEffect(() => {
    if (!visible) return;
    const longest = Math.max(...hearts.map((heart) => heart.delay + heart.duration));
    const timer = setTimeout(() => setVisible(false), longest * 1000 + 200);
    return () => clearTimeout(timer);
  }, [hearts, visible]);

  if (!visible) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden data-testid="heart-burst">
      {hearts.map((heart, index) => (
        <Heart
          key={index}
          color={heart.color}
          className="absolute -top-10 animate-heart-fall"
          style={
            {
              left: `${heart.left}%`,
              width: heart.size,
              height: heart.size,
              animationDelay: `${heart.delay}s`,
              animationDuration: `${heart.duration}s`,
              "--drift": `${heart.drift}px`,
              "--spin": `${heart.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>,
    document.body,
  );
}

/** Corazones pequeños que suben despacio, sin parar, sobre la foto de Inicio. */
export function FloatingHearts({ count = 7, className = "" }: { count?: number; className?: string }) {
  const hearts = useMemo(() => heartSpecs(count, 14, { minSize: 10, maxSize: 20, maxDelay: 8, minDuration: 7, maxDuration: 11 }), [count]);
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {hearts.map((heart, index) => (
        <Heart
          key={index}
          color="#ffffff"
          className="absolute -bottom-6 animate-heart-rise opacity-0"
          style={
            {
              left: `${heart.left}%`,
              width: heart.size,
              height: heart.size,
              animationDelay: `${heart.delay}s`,
              animationDuration: `${heart.duration}s`,
              "--drift": `${heart.drift / 3}px`,
              "--spin": `${heart.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
