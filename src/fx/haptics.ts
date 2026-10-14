import { prefersReducedMotion } from "./motion";

/** Patrones de vibración (ms): un toquecito, un "me gusta" y abrir una carta. */
export const HAPTICS = {
  tap: 8,
  like: [12, 40, 18],
  open: [20, 60, 30, 60, 40],
} as const satisfies Record<string, number | readonly number[]>;

/** Vibración suave en los teléfonos que la permiten (Android). En iPhone o sin permiso no hace nada. */
export function vibrate(pattern: number | readonly number[]): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function" || prefersReducedMotion()) return false;
  try {
    return navigator.vibrate(pattern as number | number[]);
  } catch {
    return false;
  }
}

/** true si el toque fue sobre algo que se puede pulsar (botón activo o enlace). */
export function isTappable(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("button:not(:disabled), a[href], [role='button']") !== null;
}

/** Ciclo del día en la zona horaria de la pareja: de 19:00 a 5:59 es de noche. */
export function isNightAt(time: string): boolean {
  const hour = Number(time.slice(0, 2));
  return hour >= 19 || hour < 6;
}
