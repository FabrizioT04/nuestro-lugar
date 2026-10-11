import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

// Verificación del JWT que Cloudflare Access añade a cada petición autenticada
// (cabecera Cf-Access-Jwt-Assertion). Se comprueban firma, emisor, audiencia y expiración.
// La cabecera Cf-Access-Authenticated-User-Email NO se usa: sin verificar la firma,
// cualquiera que llegara al Worker por otra vía podría falsificarla.

export interface AccessConfig {
  teamDomain: string;
  audience: string;
}

export class AccessTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessTokenError";
  }
}

// Las claves públicas se cachean entre peticiones dentro de la misma instancia del Worker.
const jwksCache = new Map<string, JWTVerifyGetKey>();

function remoteJwks(teamDomain: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

export function normalizeTeamDomain(raw: string): string {
  const withScheme = raw.startsWith("http") ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

/** Devuelve el correo verificado del token, o lanza AccessTokenError. */
export async function verifyAccessJwt(
  token: string,
  config: AccessConfig,
  getKey: JWTVerifyGetKey = remoteJwks(config.teamDomain),
): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, getKey, {
      issuer: config.teamDomain,
      audience: config.audience,
      algorithms: ["RS256"],
    });
    if (typeof payload.email !== "string" || payload.email.length === 0) {
      throw new AccessTokenError("El token no contiene un correo");
    }
    return payload.email.toLowerCase();
  } catch (err) {
    if (err instanceof AccessTokenError) throw err;
    throw new AccessTokenError(err instanceof Error ? err.message : "Token inválido");
  }
}
