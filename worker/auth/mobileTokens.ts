import { SignJWT, errors, jwtVerify } from "jose";

// Tokens propios de la app móvil (fase 12). Los firma el Worker con MOBILE_TOKEN_SECRET (HS256),
// que vive solo en el Worker: la app nunca tiene secretos, solo los tokens de su sesión.
//
//   - Token de acceso: 15 minutos, va en la cabecera Authorization de cada petición a /api.
//   - Token de fotos: solo sirve para VER fotos y audios (<img src>, que no puede llevar cabeceras).
//     Es igual durante toda una semana para que las URLs no cambien y el caché funcione.
//   - Refresh token: aleatorio, el Worker solo guarda su hash. Rota en cada uso.
// Todos llevan el id de la sesión: cerrar sesión los invalida en la siguiente petición.

const ISSUER = "nuestro-lugar";
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const MEDIA_WINDOW_SECONDS = 7 * 24 * 60 * 60;

export type MobileTokenScope = "api" | "media";

export interface MobileTokenClaims {
  userId: string;
  sessionId: string;
  email: string;
}

export class MobileTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MobileTokenError";
  }
}

const encoder = new TextEncoder();
const key = (secret: string) => encoder.encode(secret);

/** Un secreto corto haría los tokens adivinables: se exige al menos 32 caracteres. */
export function usableSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= 32;
}

export function signAccessToken(claims: MobileTokenClaims, secret: string, now = Date.now()): Promise<string> {
  const iat = Math.floor(now / 1000);
  return new SignJWT({ sid: claims.sessionId, email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience("api")
    .setSubject(claims.userId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ACCESS_TOKEN_TTL_SECONDS)
    .sign(key(secret));
}

/**
 * Sin fecha de emisión a propósito: dentro de la misma ventana semanal sale exactamente el mismo
 * token, así las URLs de las fotos no cambian. Vence al final de la ventana siguiente (1 a 2 semanas).
 */
export function signMediaToken(claims: MobileTokenClaims, secret: string, now = Date.now()): Promise<string> {
  const window = Math.floor(now / 1000 / MEDIA_WINDOW_SECONDS);
  return new SignJWT({ sid: claims.sessionId, email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience("media")
    .setSubject(claims.userId)
    .setExpirationTime((window + 2) * MEDIA_WINDOW_SECONDS)
    .sign(key(secret));
}

export async function verifyMobileToken(
  token: string,
  scope: MobileTokenScope,
  secret: string,
  now = Date.now(),
): Promise<MobileTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: scope,
      algorithms: ["HS256"],
      currentDate: new Date(now),
    });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string" || typeof payload.email !== "string") {
      throw new MobileTokenError("Token incompleto");
    }
    return { userId: payload.sub, sessionId: payload.sid, email: payload.email.toLowerCase() };
  } catch (err) {
    if (err instanceof MobileTokenError) throw err;
    if (err instanceof errors.JWTExpired) throw new MobileTokenError("Token vencido");
    throw new MobileTokenError("Token inválido");
  }
}

// --- Valores aleatorios, hashes y PKCE ---

export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 32 bytes aleatorios en base64url (43 caracteres). */
export function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256(value: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

/** PKCE S256: el desafío es el SHA-256 del verificador. */
export const pkceChallenge = sha256;

/** Compara sin cortar en el primer carácter distinto. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
