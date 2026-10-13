import { App } from "@capacitor/app";
import { completeGoogleLogin, loadMobileSession } from "@/auth/mobileSession";
import { DEEP_LINK_SCHEME } from "./native";

// Arranque de la app de Android: sesión guardada, deep links y botón "atrás".
//
// Deep links: nuestrolugar://auth?code=… (regreso del inicio de sesión) y cualquier pantalla de la app,
// p. ej. nuestrolugar://recuerdos/<id> o nuestrolugar://planes. Así otra app (la futura "Nuestra
// Granjita") o una notificación pueden abrir una pantalla concreta.

type Navigate = (path: string) => void;

/** nuestrolugar://recuerdos/123?x=1 → /recuerdos/123?x=1. null si no es un deep link de la app. */
export function deepLinkPath(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== DEEP_LINK_SCHEME) return null;
  const path = `/${url.host}${url.pathname === "/" ? "" : url.pathname}`.replace(/\/+$/, "") || "/";
  return `${path}${url.search}`;
}

function handleUrl(raw: string, navigate: Navigate) {
  const path = deepLinkPath(raw);
  if (path === null) return;
  if (path.startsWith("/auth?") || path === "/auth") void completeGoogleLogin(new URL(raw));
  else navigate(path);
}

/** Se llama una vez antes de pintar la app. */
export async function startNativeApp(navigate: Navigate): Promise<void> {
  await loadMobileSession();

  // Se esperan los registros para no perder un deep link que llegue justo al abrir.
  await App.addListener("appUrlOpen", ({ url }) => handleUrl(url, navigate));
  // Si la app estaba cerrada y la abrió un deep link.
  const launch = await App.getLaunchUrl().catch(() => undefined);
  if (launch?.url) handleUrl(launch.url, navigate);

  // Botón "atrás" de Android: vuelve a la pantalla anterior; en la primera, sale de la app.
  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.exitApp();
  });
}
