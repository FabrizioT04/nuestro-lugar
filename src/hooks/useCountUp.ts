import { useEffect, useState } from "react";
import { countUpValue, prefersReducedMotion } from "@/fx/motion";

/** Número que sube desde 0 hasta `target` al aparecer. Con "reducir movimiento" se muestra directo. */
export function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const next = countUpValue(target, now - start, duration);
      setValue(next);
      if (next !== target) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
