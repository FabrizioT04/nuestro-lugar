import type { MobileLoginError, MobileSessionResponse } from "@shared/api";
import type { Bindings } from "../env";
import { isAllowedEmail, parseAllowedEmails } from "../auth/allowedEmails";
import { exchangeGoogleCode, googleAuthorizeUrl, GoogleOAuthError } from "../auth/googleOAuth";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  MobileTokenError,
  pkceChallenge,
  randomToken,
  safeEqual,
  sha256,
  signAccessToken,
  signMediaToken,
  usableSecret,
  verifyMobileToken,
  type MobileTokenClaims,
  type MobileTokenScope,
} from "../auth/mobileTokens";
import { createMobileSessionRepository } from "../repositories/mobileSessionRepository";
import { createUserRepository } from "../repositories/userRepository";
import type { AuthenticatedUser } from "../auth/types";
import { misconfigured, unauthorized } from "../utils/errors";

// Inicio de sesión de la app móvil (fase 12). El flujo completo:
//
//   1. La app crea un verificador PKCE, guarda el verificador y abre en el navegador del sistema
//      /api/auth/mobile/start?challenge=SHA256(verificador).
//   2. El Worker guarda el intento y manda a Google (con su propio PKCE, state y nonce).
//   3. Google vuelve a /api/auth/mobile/callback. El Worker cambia el código por el ID token
//      (con el secreto del cliente, que solo tiene el Worker), aplica la lista de correos y
//      devuelve a la app un código de un solo uso por deep link: nuestrolugar://auth?code=…
//   4. La app manda ese código + su verificador a /api/auth/mobile/token. Si otra app hubiera
//      interceptado el deep link, no tendría el verificador y el código no le serviría.
//   5. El Worker crea la sesión y entrega token de acceso, token de fotos y refresh token.

export const APP_DEEP_LINK = "nuestrolugar://auth";
const LOGIN_REQUEST_TTL_MS = 10 * 60 * 1000;
const LOGIN_CODE_TTL_MS = 2 * 60 * 1000;
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** Si la respuesta de un refresh se perdió, la app puede reintentar con el token anterior un momento. */
const REFRESH_GRACE_MS = 2 * 60 * 1000;

const log = (level: "warn" | "error", message: string, extra: Record<string, unknown> = {}) =>
  console[level](JSON.stringify({ level, message, ...extra }));

interface MobileConfig {
  clientId: string;
  clientSecret: string;
  tokenSecret: string;
}

function mobileConfig(env: Bindings): MobileConfig {
  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, MOBILE_TOKEN_SECRET } = env;
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !usableSecret(MOBILE_TOKEN_SECRET)) {
    log("error", "Faltan GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET o MOBILE_TOKEN_SECRET (32+ caracteres)");
    throw misconfigured();
  }
  return { clientId: GOOGLE_OAUTH_CLIENT_ID, clientSecret: GOOGLE_OAUTH_CLIENT_SECRET, tokenSecret: MOBILE_TOKEN_SECRET };
}

function tokenSecret(env: Bindings): string {
  if (!usableSecret(env.MOBILE_TOKEN_SECRET)) {
    log("error", "MOBILE_TOKEN_SECRET falta o es muy corto");
    throw misconfigured();
  }
  return env.MOBILE_TOKEN_SECRET;
}

function isAllowed(env: Bindings, email: string): boolean {
  const allowed = parseAllowedEmails(env.ALLOWED_EMAILS);
  if (allowed.length === 0) {
    log("error", "ALLOWED_EMAILS está vacío");
    throw misconfigured();
  }
  return isAllowedEmail(email, allowed);
}

export const callbackUrl = (origin: string) => `${origin}/api/auth/mobile/callback`;

/** Paso 2: guarda el intento y devuelve la URL de Google. */
export async function startMobileLogin(env: Bindings, origin: string, appChallenge: string, now = Date.now()): Promise<string> {
  const config = mobileConfig(env);
  const state = randomToken();
  const googleVerifier = randomToken();
  const nonce = randomToken();
  await createMobileSessionRepository(env.DB).createLoginRequest({ id: state, appChallenge, googleVerifier, nonce, now, ttlMs: LOGIN_REQUEST_TTL_MS });
  return googleAuthorizeUrl(
    { clientId: config.clientId, redirectUri: callbackUrl(origin) },
    { state, nonce, codeChallenge: await pkceChallenge(googleVerifier) },
  );
}

export type CallbackResult = { ok: true; code: string } | { ok: false; error: MobileLoginError };

/** Paso 3: vuelve de Google. Nunca lanza: el resultado siempre se le devuelve a la app. */
export async function completeMobileLogin(
  env: Bindings,
  origin: string,
  params: { state?: string; code?: string; error?: string },
  deps: { exchange?: typeof exchangeGoogleCode; now?: number } = {},
): Promise<CallbackResult> {
  const now = deps.now ?? Date.now();
  const exchange = deps.exchange ?? exchangeGoogleCode;
  const config = mobileConfig(env);
  const repo = createMobileSessionRepository(env.DB);

  if (params.error) return { ok: false, error: params.error === "access_denied" ? "cancelled" : "failed" };
  if (!params.state || !params.code) return { ok: false, error: "failed" };

  const request = await repo.findLoginRequest(params.state);
  if (!request || request.used_at || request.user_id) return { ok: false, error: "failed" };
  if (Date.parse(request.expires_at) < now) return { ok: false, error: "expired" };

  let email: string;
  try {
    email = await exchange(
      { clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: callbackUrl(origin) },
      { code: params.code, codeVerifier: request.google_verifier, nonce: request.nonce },
    );
  } catch (err) {
    if (!(err instanceof GoogleOAuthError)) throw err;
    log("warn", `Inicio de sesión móvil rechazado: ${err.message}`);
    return { ok: false, error: "failed" };
  }

  if (!isAllowed(env, email)) {
    log("warn", "Correo no permitido (app móvil)", { email });
    return { ok: false, error: "forbidden" };
  }

  const user = await createUserRepository(env.DB).findOrCreate(email);
  const code = randomToken();
  const completed = await repo.completeLoginRequest(request.id, user.id, await sha256(code), now + LOGIN_CODE_TTL_MS);
  return completed ? { ok: true, code } : { ok: false, error: "failed" };
}

async function issueTokens(env: Bindings, claims: MobileTokenClaims, refreshToken: string, now: number): Promise<MobileSessionResponse> {
  const secret = tokenSecret(env);
  return {
    accessToken: await signAccessToken(claims, secret, now),
    accessTokenExpiresAt: (Math.floor(now / 1000) + ACCESS_TOKEN_TTL_SECONDS) * 1000,
    refreshToken,
    mediaToken: await signMediaToken(claims, secret, now),
  };
}

/** Paso 4–5: código de un solo uso + verificador PKCE → sesión nueva. */
export async function redeemLoginCode(env: Bindings, input: { code: string; verifier: string }, now = Date.now()): Promise<MobileSessionResponse> {
  tokenSecret(env);
  const repo = createMobileSessionRepository(env.DB);
  const request = await repo.findByLoginCode(await sha256(input.code));
  const invalid = () => unauthorized("El inicio de sesión no es válido o expiró. Inténtalo otra vez.");
  if (!request?.user_id || request.used_at || Date.parse(request.expires_at) < now) throw invalid();
  if (!safeEqual(await pkceChallenge(input.verifier), request.app_challenge)) {
    log("warn", "Verificador PKCE incorrecto en la app móvil");
    throw invalid();
  }
  if (!(await repo.consumeLoginRequest(request.id, now))) throw invalid();

  const email = await userEmail(env, request.user_id);
  if (!email || !isAllowed(env, email)) throw invalid();

  const sessionId = crypto.randomUUID();
  const refreshToken = randomToken();
  await repo.createSession({ id: sessionId, userId: request.user_id, refreshHash: await sha256(refreshToken), now, ttlMs: SESSION_TTL_MS });
  return issueTokens(env, { userId: request.user_id, sessionId, email }, refreshToken, now);
}

/** Refresh token → tokens nuevos (y refresh token nuevo). */
export async function refreshMobileSession(env: Bindings, refreshToken: string, now = Date.now()): Promise<MobileSessionResponse> {
  tokenSecret(env);
  const repo = createMobileSessionRepository(env.DB);
  const presented = await sha256(refreshToken);
  const expired = () => unauthorized("Tu sesión expiró");
  const session = await repo.findSessionByRefreshHash(presented);
  if (!session || session.revoked_at || Date.parse(session.expires_at) < now) throw expired();

  if (session.refresh_hash !== presented) {
    // Es el token anterior. Recién rotado: la respuesta se perdió y la app reintenta.
    // Más tarde: alguien lo copió. Se cierra la sesión entera por seguridad.
    if (now - Date.parse(session.rotated_at) > REFRESH_GRACE_MS) {
      log("warn", "Refresh token reutilizado: se cierra la sesión", { sessionId: session.id });
      await repo.revoke(session.id, now);
      throw expired();
    }
  }

  const email = await userEmail(env, session.user_id);
  if (!email || !isAllowed(env, email)) {
    await repo.revoke(session.id, now);
    throw expired();
  }

  const next = randomToken();
  if (!(await repo.rotate(session.id, presented, await sha256(next), now, SESSION_TTL_MS))) throw expired();
  return issueTokens(env, { userId: session.user_id, sessionId: session.id, email }, next, now);
}

export async function logoutMobileSession(env: Bindings, sessionId: string, now = Date.now()): Promise<void> {
  await createMobileSessionRepository(env.DB).revoke(sessionId, now);
}

async function userEmail(env: Bindings, userId: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT email FROM users WHERE id = ?1").bind(userId).first<{ email: string }>();
  return row?.email.toLowerCase() ?? null;
}

/**
 * Comprueba un token de la app en cada petición: firma, vencimiento, que la sesión siga abierta
 * y que el correo siga en la lista. Devuelve el usuario y la sesión.
 */
export async function authenticateMobile(
  env: Bindings,
  token: string,
  scope: MobileTokenScope,
  now = Date.now(),
): Promise<{ user: AuthenticatedUser; sessionId: string }> {
  let claims: MobileTokenClaims;
  try {
    claims = await verifyMobileToken(token, scope, tokenSecret(env), now);
  } catch (err) {
    if (err instanceof MobileTokenError) throw unauthorized(err.message === "Token vencido" ? "Tu sesión expiró" : "Tu sesión no es válida");
    throw err;
  }
  const session = await createMobileSessionRepository(env.DB).findSession(claims.sessionId);
  if (!session || session.revoked_at || session.user_id !== claims.userId || Date.parse(session.expires_at) < now) {
    throw unauthorized("Tu sesión terminó");
  }
  return { user: await authorizedUser(env, claims.email), sessionId: session.id };
}

async function authorizedUser(env: Bindings, email: string): Promise<AuthenticatedUser> {
  if (!isAllowed(env, email)) throw unauthorized("Tu sesión terminó");
  return createUserRepository(env.DB).findOrCreate(email);
}
