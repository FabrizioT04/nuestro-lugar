import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

// Inicio de sesión con Google para la app móvil (OAuth 2.0 Authorization Code + PKCE).
// Todo pasa en el Worker: la app solo abre el navegador. El "client secret" vive como secreto
// del Worker y la contraseña de Google la escribe la persona en la página de Google, nunca en la app.

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GoogleOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleOAuthError";
  }
}

let googleJwks: JWTVerifyGetKey | null = null;
const defaultJwks = () => (googleJwks ??= createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")));

export function googleAuthorizeUrl(
  config: Pick<GoogleOAuthConfig, "clientId" | "redirectUri">,
  params: { state: string; nonce: string; codeChallenge: string },
): string {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    // Solo identidad: correo verificado. Nada de acceso a otros datos de Google.
    scope: "openid email",
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

/** Cambia el código de Google por su ID token y devuelve el correo verificado. */
export async function exchangeGoogleCode(
  config: GoogleOAuthConfig,
  params: { code: string; codeVerifier: string; nonce: string },
  deps: { fetch?: typeof fetch; jwks?: JWTVerifyGetKey } = {},
): Promise<string> {
  const doFetch = deps.fetch ?? fetch;
  let response: Response;
  try {
    response = await doFetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: params.code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
        code_verifier: params.codeVerifier,
      }),
    });
  } catch {
    throw new GoogleOAuthError("Google no respondió");
  }
  const body = (await response.json().catch(() => null)) as { id_token?: unknown; error?: unknown } | null;
  if (!response.ok || typeof body?.id_token !== "string") {
    throw new GoogleOAuthError(`Google rechazó el código (${response.status} ${String(body?.error ?? "")})`);
  }
  return verifyGoogleIdToken(body.id_token, { clientId: config.clientId, nonce: params.nonce }, deps.jwks);
}

export async function verifyGoogleIdToken(
  idToken: string,
  expected: { clientId: string; nonce: string },
  jwks: JWTVerifyGetKey = defaultJwks(),
): Promise<string> {
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, jwks, { issuer: GOOGLE_ISSUERS, audience: expected.clientId, algorithms: ["RS256"] }));
  } catch (err) {
    throw new GoogleOAuthError(`ID token inválido: ${err instanceof Error ? err.message : "desconocido"}`);
  }
  if (payload.nonce !== expected.nonce) throw new GoogleOAuthError("El nonce no coincide");
  if (payload.email_verified !== true || typeof payload.email !== "string") {
    throw new GoogleOAuthError("Google no confirmó el correo");
  }
  return payload.email.toLowerCase();
}
