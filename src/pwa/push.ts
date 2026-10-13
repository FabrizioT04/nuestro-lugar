import { pushApi } from "@/services/api/push";
import { isNativeApp } from "@/platform/native";

// Notificaciones push en la web/PWA (fase 13). Web Push estándar con claves VAPID: sin Firebase
// ni cuentas de terceros. El navegador guarda la suscripción; el Worker solo recibe su URL y
// sus claves públicas.

export type PushSupport =
  | "supported"
  /** En la app de Android (Capacitor) Web Push no existe; necesitaría Firebase. */
  | "native"
  /** iPhone/iPad sin instalar en la pantalla de inicio (Safari solo lo permite en la app instalada). */
  | "ios-needs-install"
  | "unsupported";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function pushSupport(): PushSupport {
  if (isNativeApp) return "native";
  const apis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIos() && !isStandalone()) return "ios-needs-install";
  return apis ? "supported" : "unsupported";
}

/** Clave pública VAPID (base64url) → bytes, como la pide `pushManager.subscribe`. */
export function applicationServerKey(publicKey: string): Uint8Array<ArrayBuffer> {
  const base64 = publicKey.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (publicKey.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // El service worker se registra al abrir la app (solo en producción); aquí se espera a que esté activo.
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) throw new PushError("no-service-worker");
  return navigator.serviceWorker.ready;
}

export class PushError extends Error {
  constructor(readonly reason: "denied" | "no-service-worker" | "server-disabled") {
    super(reason);
  }
}

/** Suscripción de este dispositivo, si la hay. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "supported") return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Pide permiso, suscribe este dispositivo y se lo cuenta al Worker. */
export async function enablePush(publicKey: string | null): Promise<PushSubscription> {
  if (!publicKey) throw new PushError("server-disabled");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new PushError("denied");

  const reg = await registration();
  const key = applicationServerKey(publicKey);
  let subscription = await reg.pushManager.getSubscription();
  // Si las claves del servidor cambiaron, la suscripción vieja ya no sirve.
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe().catch(() => undefined);
    subscription = null;
  }
  subscription ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await pushApi.subscribe(subscription.toJSON());
  return subscription;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const bytes = new Uint8Array(a);
  return bytes.length === b.length && bytes.every((value, i) => value === b[i]);
}

/** Apaga los avisos en este dispositivo (y lo olvida en el Worker). */
export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await pushApi.unsubscribe(subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
}

/**
 * Al abrir la app: si este dispositivo tiene avisos activados, se lo recuerda al Worker (por si la
 * suscripción cambió o el Worker la olvidó). Sin efectos si no hay suscripción.
 */
export async function refreshPushSubscription(): Promise<void> {
  try {
    if (Notification.permission !== "granted") return;
    const subscription = await currentSubscription();
    if (subscription) await pushApi.subscribe(subscription.toJSON());
  } catch {
    // Sin conexión o sin sesión: se intenta la próxima vez.
  }
}
