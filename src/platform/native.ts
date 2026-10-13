import { Capacitor } from "@capacitor/core";

/** true dentro de la app de Android (Capacitor); false en el navegador o la PWA. */
export const isNativeApp = Capacitor.isNativePlatform();

/**
 * Dirección del Worker de la app (`app-movil`, sin Cloudflare Access). Es pública: no es un secreto.
 * La web/PWA no la usa: sigue hablando con /api en su mismo dominio.
 */
export const MOBILE_API_ORIGIN: string = import.meta.env.VITE_MOBILE_API_ORIGIN || "https://app-movil.nuestro-lugar.workers.dev";

/** Esquema de los deep links de la app: nuestrolugar://recuerdos/…, nuestrolugar://auth?code=… */
export const DEEP_LINK_SCHEME = "nuestrolugar:";
