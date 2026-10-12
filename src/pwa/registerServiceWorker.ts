/**
 * Registra public/sw.js (solo en producción: en `npm run dev` el caché estorbaría al programar).
 * Cuando hay una versión nueva, el service worker se activa solo y la próxima vez que se abra la
 * app ya carga la nueva.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sin service worker la app sigue funcionando, solo que sin modo offline.
    });
  });
}
