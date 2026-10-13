import { isNativeApp } from "@/platform/native";
import { logoutMobile } from "./mobileSession";

// En la web, cerrar sesión e iniciar sesión pasan por Cloudflare Access, no por la app.
export const LOGOUT_URL = "/cdn-cgi/access/logout";

/** Cierra la sesión: en la web, por Access; en la app, sus propios tokens (vuelve a la pantalla de entrar). */
export async function signOut(): Promise<void> {
  if (isNativeApp) await logoutMobile();
  else window.location.href = LOGOUT_URL;
}

const RELOAD_KEY = "nl:last-auth-reload";
const RELOAD_COOLDOWN_MS = 30_000;

/**
 * Recarga la página para que Access muestre su login. Como mucho una vez cada 30 s,
 * para no entrar en un bucle si Access está mal configurado.
 * Devuelve false si no recargó.
 */
export function reloadForLogin(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage no disponible: recargar igualmente una vez.
  }
  window.location.reload();
  return true;
}
