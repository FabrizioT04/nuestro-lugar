import { base64url } from "../auth/mobileTokens";

// Web Push estándar, sin librerías ni Firebase, solo con WebCrypto (disponible en Workers):
//   - RFC 8292 (VAPID): el Worker se identifica ante el servicio de push con un JWT ES256.
//   - RFC 8291 + RFC 8188 (aes128gcm): el contenido va cifrado; el servicio de push (Google, Mozilla,
//     Apple) solo ve bytes cifrados. Solo el navegador suscrito puede leerlo.

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidKeys {
  /** Clave pública P-256 sin comprimir (65 bytes) en base64url. Es la que usa el navegador. */
  publicKey: string;
  /** Parte privada "d" (32 bytes) en base64url. Solo vive en el Worker como secreto. */
  privateKey: string;
  /** Contacto para el servicio de push: "mailto:..." o una URL https. */
  subject: string;
}

export interface PushMessageOptions {
  /** Segundos que el servicio de push guarda el aviso si el teléfono está apagado. */
  ttl: number;
  urgency?: "very-low" | "low" | "normal" | "high";
}

/** Resultado de un envío: `gone` = la suscripción ya no existe y hay que borrarla. */
export type PushSendResult = { ok: true } | { ok: false; gone: boolean; status: number };

const RECORD_SIZE = 4096;
const encoder = new TextEncoder();

/**
 * Servicios de push conocidos. El Worker solo envía a estos dominios: una "suscripción" con otra URL
 * se rechaza, así nadie puede usar el Worker para hacer peticiones a sitios arbitrarios.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge (Android) y otros Chromium
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^web\.push\.apple\.com$/, // Safari (iPhone con la app instalada, Mac)
  /^[a-z0-9-]+\.notify\.windows\.com$/, // Edge en Windows
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return url.protocol === "https:" && url.port === "" && url.username === "" && PUSH_HOSTS.some((host) => host.test(url.hostname));
}

export function base64urlDecode(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Las claves VAPID están completas y con el formato correcto. */
export function usableVapidKeys(publicKey?: string, privateKey?: string): boolean {
  try {
    return !!publicKey && !!privateKey && base64urlDecode(publicKey).length === 65 && base64urlDecode(privateKey).length === 32;
  } catch {
    return false;
  }
}

function importVapidPrivateKey(keys: VapidKeys): Promise<CryptoKey> {
  const pub = base64urlDecode(keys.publicKey);
  return crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: base64url(pub.slice(1, 33)), y: base64url(pub.slice(33, 65)), d: keys.privateKey, ext: false },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/** JWT VAPID (ES256) para el origen del servicio de push. Vale 12 horas (el máximo permitido son 24). */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, now = Date.now()): Promise<string> {
  const header = base64url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = { aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: keys.subject };
  const unsigned = `${header}.${base64url(encoder.encode(JSON.stringify(claims)))}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    await importVapidPrivateKey(keys),
    encoder.encode(unsigned),
  );
  return `vapid t=${unsigned}.${base64url(new Uint8Array(signature))}, k=${keys.publicKey}`;
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, bytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits: ArrayBuffer = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8);
  return new Uint8Array(bits);
}

/** Datos aleatorios del envío; solo se pasan a mano en las pruebas. */
export interface EncryptionSeed {
  serverKeys: CryptoKeyPair;
  salt: Uint8Array<ArrayBuffer>;
}

/** Cifra el contenido para una suscripción (RFC 8291, un solo registro aes128gcm). */
export async function encryptPayload(
  subscription: Pick<PushSubscriptionKeys, "p256dh" | "auth">,
  payload: string,
  seed?: EncryptionSeed,
): Promise<Uint8Array<ArrayBuffer>> {
  const clientPublic = base64urlDecode(subscription.p256dh);
  const authSecret = base64urlDecode(subscription.auth);
  if (clientPublic.length !== 65 || authSecret.length !== 16) throw new Error("Suscripción con claves inválidas");

  const plaintext = encoder.encode(payload);
  // 86 bytes de encabezado + 16 de la etiqueta de AES-GCM + 1 del delimitador.
  if (plaintext.length > RECORD_SIZE - 86 - 17) throw new Error("Aviso demasiado largo");

  const serverKeys =
    seed?.serverKeys ?? ((await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair);
  const salt = seed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const serverPublic = new Uint8Array((await crypto.subtle.exportKey("raw", serverKeys.publicKey)) as ArrayBuffer);

  const clientKey = await crypto.subtle.importKey("raw", clientPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  // Los tipos de Workers llaman "$public" a este campo (palabra reservada); en ejecución es "public".
  const ecdh = { name: "ECDH", public: clientKey } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const sharedSecret = new Uint8Array((await crypto.subtle.deriveBits(ecdh, serverKeys.privateKey, 256)) as ArrayBuffer);

  const keyInfo = concat(encoder.encode("WebPush: info\0"), clientPublic, serverPublic);
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, concat(encoder.encode("Content-Encoding: aes128gcm\0")), 16);
  const nonce = await hkdf(salt, ikm, concat(encoder.encode("Content-Encoding: nonce\0")), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // 0x02 = delimitador del último (y único) registro, sin relleno extra.
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, concat(plaintext, Uint8Array.of(2))));

  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = serverPublic.length;
  return concat(header, serverPublic, ciphertext);
}

/** Envía un aviso a una suscripción. Nunca lanza por errores del servicio de push. */
export async function sendPush(
  subscription: PushSubscriptionKeys,
  payload: string,
  keys: VapidKeys,
  options: PushMessageOptions,
  fetcher: typeof fetch = fetch,
): Promise<PushSendResult> {
  if (!isAllowedPushEndpoint(subscription.endpoint)) return { ok: false, gone: true, status: 0 };
  let body: Uint8Array<ArrayBuffer>;
  try {
    body = await encryptPayload(subscription, payload);
  } catch {
    // Claves de la suscripción rotas: no sirve de nada guardarla.
    return { ok: false, gone: true, status: 0 };
  }

  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(subscription.endpoint, keys),
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(options.ttl),
    Urgency: options.urgency ?? "normal",
  };

  try {
    const response = await fetcher(subscription.endpoint, { method: "POST", headers, body, redirect: "manual" });
    if (response.status >= 200 && response.status < 300) return { ok: true };
    // 404/410: el navegador canceló la suscripción (desinstaló, borró datos o quitó el permiso).
    return { ok: false, gone: response.status === 404 || response.status === 410, status: response.status };
  } catch {
    return { ok: false, gone: false, status: 0 };
  }
}
