import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";
import { AccessTokenError, normalizeTeamDomain, verifyAccessJwt } from "../auth/accessJwt";
import { isAllowedEmail, parseAllowedEmails } from "../auth/allowedEmails";
import { createUserRepository } from "../repositories/userRepository";
import { authenticateMobile } from "../services/mobileAuthService";
import { conflict, forbidden, misconfigured, unauthorized } from "../utils/errors";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Atajo SOLO para desarrollo local: no hay Cloudflare Access delante de `npm run dev`.
 * Requiere a la vez ENVIRONMENT=development (solo existe en .dev.vars, que nunca se despliega),
 * DEV_USER_EMAIL y que la petición llegue a localhost. En producción ENVIRONMENT=production.
 */
function devBypassEmail(c: Context<AppEnv>): string | null {
  const { ENVIRONMENT, DEV_USER_EMAIL } = c.env;
  if (ENVIRONMENT !== "development" || !DEV_USER_EMAIL) return null;
  if (!LOCAL_HOSTS.has(new URL(c.req.url).hostname)) return null;
  return DEV_USER_EMAIL.trim().toLowerCase();
}

async function resolveEmail(c: Context<AppEnv>): Promise<string> {
  const devEmail = devBypassEmail(c);
  if (devEmail) return devEmail;

  const token = c.req.header("cf-access-jwt-assertion");
  if (!token) throw unauthorized();

  const { ACCESS_TEAM_DOMAIN, ACCESS_AUD } = c.env;
  if (!ACCESS_TEAM_DOMAIN || !ACCESS_AUD) {
    console.error(JSON.stringify({ level: "error", requestId: c.get("requestId"), message: "Faltan ACCESS_TEAM_DOMAIN o ACCESS_AUD" }));
    throw misconfigured();
  }

  try {
    return await verifyAccessJwt(token, {
      teamDomain: normalizeTeamDomain(ACCESS_TEAM_DOMAIN),
      audience: ACCESS_AUD,
    });
  } catch (err) {
    if (err instanceof AccessTokenError) {
      console.warn(JSON.stringify({ level: "warn", requestId: c.get("requestId"), message: `JWT de Access rechazado: ${err.message}` }));
      throw unauthorized("Tu sesión no es válida o expiró");
    }
    throw err;
  }
}

export const isMobileWorker = (env: AppEnv["Bindings"]) => env.AUTH_MODE === "mobile";

/** Fotos y audios: lo único que acepta el token de fotos (?mt=), porque <img> no manda cabeceras. */
const MEDIA_PATH = /^\/api\/(media\/[^/]+|capsules\/[^/]+\/media\/[^/]+)$/;

/**
 * Puerta de la app móvil: `Authorization: Bearer <token de acceso>` o, solo para ver fotos y audios,
 * `?mt=<token de fotos>`. Devuelve null si la petición no trae ninguno.
 */
async function mobileUser(c: Context<AppEnv>) {
  const header = c.req.header("authorization");
  if (header?.startsWith("Bearer ")) return authenticateMobile(c.env, header.slice(7).trim(), "api");
  const mediaToken = c.req.query("mt");
  if (mediaToken && c.req.method === "GET" && MEDIA_PATH.test(new URL(c.req.url).pathname)) {
    return authenticateMobile(c.env, mediaToken, "media");
  }
  return null;
}

/** Autenticación + whitelist. Deja el usuario en c.var.user. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  // El Worker móvil no está detrás de Access: solo acepta sus propios tokens (y el atajo de desarrollo).
  if (isMobileWorker(c.env) && !devBypassEmail(c)) {
    const result = await mobileUser(c);
    if (!result) throw unauthorized();
    c.set("user", result.user);
    c.set("mobileSessionId", result.sessionId);
    return next();
  }

  const email = await resolveEmail(c);

  const allowed = parseAllowedEmails(c.env.ALLOWED_EMAILS);
  if (allowed.length === 0) {
    console.error(JSON.stringify({ level: "error", requestId: c.get("requestId"), message: "ALLOWED_EMAILS está vacío" }));
    throw misconfigured();
  }
  if (!isAllowedEmail(email, allowed)) {
    console.warn(JSON.stringify({ level: "warn", requestId: c.get("requestId"), message: "Correo no permitido", email }));
    throw forbidden("Este lugar es privado");
  }

  c.set("user", await createUserRepository(c.env.DB).findOrCreate(email));
  await next();
});

/** Para rutas de contenido: exige que la relación ya esté configurada. Usar después de requireUser. */
export const requireRelationship = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("user").relationshipId) throw conflict("Primero completa la configuración inicial");
  await next();
});
