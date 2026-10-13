/** Utilidades puras para las animaciones (se prueban sin navegador). */

/** Curva que arranca rápido y frena suave al final. */
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

/** Valor del contador a los `elapsed` ms de una animación de `duration` ms que va de 0 a `target`. */
export function countUpValue(target: number, elapsed: number, duration: number): number {
  if (duration <= 0 || elapsed >= duration) return target;
  return Math.round(target * easeOutCubic(elapsed / duration));
}

/** Generador pseudoaleatorio con semilla: los corazones salen variados pero siempre iguales en cada render. */
export function seededRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

export interface HeartSpec {
  /** Posición horizontal en % del ancho. */
  left: number;
  /** Tamaño en px. */
  size: number;
  /** Retraso en segundos. */
  delay: number;
  /** Duración en segundos. */
  duration: number;
  /** Desvío lateral al final, en px. */
  drift: number;
  /** Giro final, en grados. */
  spin: number;
  color: string;
}

const HEART_COLORS = ["#f6a8c0", "#ffd0de", "#c9b4f2", "#d46a8c", "#ffe3ec"];

/** Corazones para la lluvia de una ocasión especial o para los que flotan en Inicio. */
export function heartSpecs(count: number, seed: number, { minSize = 14, maxSize = 30, maxDelay = 0.6, minDuration = 2.2, maxDuration = 3.4 } = {}): HeartSpec[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => ({
    left: Math.round(random() * 1000) / 10,
    size: Math.round(minSize + random() * (maxSize - minSize)),
    delay: Math.round(random() * maxDelay * 100) / 100,
    duration: Math.round((minDuration + random() * (maxDuration - minDuration)) * 100) / 100,
    drift: Math.round((random() - 0.5) * 120),
    spin: Math.round((random() - 0.5) * 60),
    color: HEART_COLORS[Math.floor(random() * HEART_COLORS.length)] ?? HEART_COLORS[0]!,
  }));
}

/** true si el sistema pidió reducir el movimiento (accesibilidad). */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
