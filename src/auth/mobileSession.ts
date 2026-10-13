import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { Browser } from "@capacitor/browser";
import type { MobileLoginError, MobileSessionResponse } from "@shared/api";
import { MOBILE_API_ORIGIN } from "@/platform/native";

// Sesión de la app de Android (fase 12). Solo se usa dentro de la app: la web usa Cloudflare Access.
//
// - El refresh token y el token de fotos se guardan en el almacenamiento seguro del sistema
//   (Android Keystore). El token de acceso (15 min) vive solo en memoria.
// - La app no tiene ningún secreto: inicia sesión con Google en el navegador del sistema y el Worker
//   le devuelve sus tokens (ver worker/services/mobileAuthService.ts).

const REFRESH_KEY = "refresh-token";
const MEDIA_KEY = "media-token";
const VERIFIER_KEY = "login-verifier";
const AUTH_URL = `${MOBILE_API_ORIGIN}/api/auth/mobile`;

let refreshToken: string | null = null;
let mediaToken: string | null = null;
let accessToken: { value: string; expiresAt: number } | null = null;
let refreshing: Promise<string | null> | null = null;
let loaded = false;

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((listener) => listener());

/** Avisa cuando se inicia o se cierra la sesión (o falla el inicio). */
export function onMobileSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Lee la sesión guardada. Se llama una vez al abrir la app, antes de pintar nada. */
export async function loadMobileSession(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    [refreshToken, mediaToken] = await Promise.all([SecureStorage.getItem(REFRESH_KEY), SecureStorage.getItem(MEDIA_KEY)]);
  } catch {
    refreshToken = mediaToken = null;
  }
}

export const hasMobileSession = () => refreshToken !== null;

/** Token para ver fotos (`?mt=`). Igual durante una semana para que el caché funcione. */
export const currentMediaToken = () => mediaToken;

async function save(session: MobileSessionResponse): Promise<void> {
  refreshToken = session.refreshToken;
  mediaToken = session.mediaToken;
  accessToken = { value: session.accessToken, expiresAt: session.accessTokenExpiresAt };
  await Promise.all([SecureStorage.setItem(REFRESH_KEY, session.refreshToken), SecureStorage.setItem(MEDIA_KEY, session.mediaToken)]);
}

/** Borra la sesión del dispositivo (no avisa al servidor). */
export async function clearMobileSession(): Promise<void> {
  refreshToken = mediaToken = accessToken = null;
  await Promise.all([SecureStorage.removeItem(REFRESH_KEY), SecureStorage.removeItem(MEDIA_KEY)]).catch(() => undefined);
  notify();
}

/** Error de red al renovar: la sesión se conserva y la app funciona offline con lo guardado. */
export class MobileNetworkError extends Error {}

async function postJson(path: string, body: unknown, token?: string): Promise<Response> {
  try {
    return await fetch(`${AUTH_URL}${path}`, {
      method: "POST",
      credentials: "omit",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new MobileNetworkError("Sin conexión con el servidor");
  }
}

/**
 * Pide tokens nuevos con el refresh token. Una sola petición a la vez (si dos pantallas lo piden
 * juntas, comparten la respuesta: el refresh token rota y no se puede usar dos veces).
 * Devuelve null si la sesión terminó.
 */
export function renewMobileSession(): Promise<string | null> {
  refreshing ??= (async () => {
    const current = refreshToken;
    if (!current) return null;
    const response = await postJson("/refresh", { refreshToken: current });
    if (response.status === 401 || response.status === 400) {
      await clearMobileSession();
      return null;
    }
    if (!response.ok) throw new MobileNetworkError(`Error ${response.status}`);
    const session = (await response.json()) as MobileSessionResponse;
    await save(session);
    return session.accessToken;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Token de acceso válido (lo renueva si está por vencer). null = no hay sesión. */
export async function mobileAccessToken(): Promise<string | null> {
  if (accessToken && accessToken.expiresAt - Date.now() > 30_000) return accessToken.value;
  return renewMobileSession();
}

// --- Iniciar y cerrar sesión ---

const LOGIN_ERRORS: Record<MobileLoginError, string> = {
  forbidden: "Esa cuenta de Google no tiene acceso. Este lugar es privado.",
  cancelled: "Cancelaste el inicio de sesión.",
  expired: "Tardó demasiado. Inténtalo otra vez.",
  failed: "No se pudo iniciar sesión. Inténtalo otra vez.",
};

let loginError: string | null = null;
/** Mensaje del último intento fallido (para la pantalla de inicio de sesión). */
export const lastLoginError = () => loginError;

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Abre Google en el navegador del sistema. La contraseña se escribe ahí, nunca en la app. */
export async function startGoogleLogin(): Promise<void> {
  loginError = null;
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  // Se guarda por si Android cierra la app mientras la persona está en Google.
  await SecureStorage.setItem(VERIFIER_KEY, verifier);
  await Browser.open({ url: `${AUTH_URL}/start?challenge=${challenge}` });
}

/** Regreso desde el navegador: nuestrolugar://auth?code=… o ?error=… */
export async function completeGoogleLogin(url: URL): Promise<void> {
  await Browser.close().catch(() => undefined);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error") as MobileLoginError | null;
  const verifier = await SecureStorage.getItem(VERIFIER_KEY).catch(() => null);
  await SecureStorage.removeItem(VERIFIER_KEY).catch(() => undefined);

  if (!code || !verifier) {
    loginError = LOGIN_ERRORS[error && error in LOGIN_ERRORS ? error : "failed"];
  } else {
    try {
      const response = await postJson("/token", { code, verifier });
      if (response.ok) await save((await response.json()) as MobileSessionResponse);
      else loginError = LOGIN_ERRORS[response.status === 401 ? "expired" : "failed"];
    } catch {
      loginError = "Sin conexión. Revisa tu Internet e inténtalo otra vez.";
    }
  }
  notify();
}

/** Cierra la sesión en el servidor (si hay conexión) y en el dispositivo. */
export async function logoutMobile(): Promise<void> {
  const token = await mobileAccessToken().catch(() => null);
  if (token) await postJson("/logout", {}, token).catch(() => undefined);
  await clearMobileSession();
}
