import { useEffect, useRef, useState } from "react";
import { HAPTICS, vibrate } from "@/fx/haptics";
import { prefersReducedMotion } from "@/fx/motion";

const HOLD_MS = 1000;
const RADIUS = 26;
const CIRCLE = 2 * Math.PI * RADIUS;

/**
 * "Mantén presionado para abrir": un anillo se va llenando mientras se sostiene el dedo.
 * Si suelta antes, el anillo vuelve. Con teclado (Enter o Espacio) abre directo.
 */
export function HoldToOpen({ onOpen, disabled, label = "Mantén presionado para abrir" }: { onOpen: () => void; disabled?: boolean; label?: string }) {
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);
  const start = useRef<number | null>(null);
  const done = useRef(false);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  // Si abrir falló, se puede volver a intentar.
  useEffect(() => {
    if (!disabled) {
      done.current = false;
      setProgress(0);
    }
  }, [disabled]);

  function begin() {
    if (disabled || done.current) return;
    if (prefersReducedMotion()) return finish();
    start.current = performance.now();
    vibrate(HAPTICS.tap);
    const tick = (now: number) => {
      if (start.current === null) return;
      const value = Math.min(1, (now - start.current) / HOLD_MS);
      setProgress(value);
      if (value >= 1) finish();
      else frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }

  function cancel() {
    if (done.current) return;
    start.current = null;
    cancelAnimationFrame(frame.current);
    setProgress(0);
  }

  function finish() {
    done.current = true;
    start.current = null;
    setProgress(1);
    vibrate(HAPTICS.open);
    onOpen();
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId);
          begin();
        }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onContextMenu={(event) => event.preventDefault()}
        onClick={(event) => {
          // Teclado o lector de pantalla: el "clic" llega sin puntero y abre de una vez.
          if (event.detail === 0 && !done.current) finish();
        }}
        className="relative flex h-16 w-16 touch-none items-center justify-center rounded-full bg-ink text-white transition select-none active:scale-95 disabled:opacity-60"
        style={{ WebkitTouchCallout: "none" }}
      >
        <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={RADIUS} fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth="4" />
          <circle cx="32" cy="32" r={RADIUS} fill="none" stroke="#ff8aa3" strokeWidth="4" strokeLinecap="round" strokeDasharray={CIRCLE} strokeDashoffset={CIRCLE * (1 - progress)} />
        </svg>
        <svg viewBox="0 0 24 24" className="h-6 w-6" style={{ transform: `scale(${1 + progress * 0.25})` }} aria-hidden>
          <path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.2 4.5 7 4.5c2 0 3.6 1.1 5 2.8 1.4-1.7 3-2.8 5-2.8 3.8 0 5.9 3.8 4.5 7.2C19.5 16.4 12 21 12 21z" fill="currentColor" />
        </svg>
      </button>
      <p className="text-xs font-medium text-ink-soft">{disabled ? "Abriendo…" : progress > 0 ? "Sigue presionando…" : label}</p>
    </div>
  );
}
