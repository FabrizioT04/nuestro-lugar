import { BOTTOM_NAV } from "./navigation";

export type SlideDirection = "right" | "left" | "none";

/** Posición de una pestaña de la barra de abajo (-1 si la ruta no es una pestaña). */
export function tabIndex(pathname: string): number {
  return BOTTOM_NAV.findIndex((item) => item.to === pathname);
}

const depth = (pathname: string) => pathname.split("/").filter(Boolean).length;

/**
 * Hacia dónde entra la pantalla nueva, como en Instagram: entre pestañas según su orden;
 * al entrar a un detalle desde la derecha y al volver desde la izquierda.
 */
export function slideDirection(from: string | null, to: string): SlideDirection {
  if (from === null || from === to) return "none";
  const a = tabIndex(from);
  const b = tabIndex(to);
  if (a >= 0 && b >= 0) return b > a ? "right" : "left";
  const da = depth(from);
  const db = depth(to);
  if (db > da) return "right";
  if (db < da) return "left";
  return "none";
}

/** Pestaña vecina al deslizar el dedo: hacia la izquierda va a la siguiente. */
export function swipeTarget(pathname: string, dx: number, dy: number): string | null {
  const index = tabIndex(pathname);
  if (index < 0 || Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.5) return null;
  return BOTTOM_NAV[index + (dx < 0 ? 1 : -1)]?.to ?? null;
}

/** No se cambia de pestaña si el gesto empezó en algo que ya se desliza solo (carruseles, filtros) o en un campo. */
export function startsInScrollable(target: EventTarget | null): boolean {
  let element = target instanceof Element ? target : null;
  while (element && element !== document.body) {
    if (element.matches("input, textarea, select, [contenteditable], [data-no-swipe]")) return true;
    const overflow = getComputedStyle(element).overflowX;
    if ((overflow === "auto" || overflow === "scroll") && element.scrollWidth > element.clientWidth) return true;
    element = element.parentElement;
  }
  return false;
}
