import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { MobileLoginError } from "@shared/api";
import { mobileRefreshSchema, mobileStartQuerySchema, mobileTokenSchema } from "@shared/schemas";
import type { AppEnv } from "../env";
import { requireUser } from "../middleware/auth";
import {
  APP_DEEP_LINK,
  completeMobileLogin,
  logoutMobileSession,
  redeemLoginCode,
  refreshMobileSession,
  startMobileLogin,
} from "../services/mobileAuthService";
import { parseJsonBody, parseQuery } from "../utils/validation";
import { misconfigured, rateLimited } from "../utils/errors";

// Rutas del inicio de sesión de la app móvil. Solo existen en el Worker móvil (AUTH_MODE=mobile).
// Antes de entrar no hay usuario: el límite de intentos es por IP.

const limitAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.env.AUTH_LIMITER) throw misconfigured();
  const ip = c.req.header("cf-connecting-ip") ?? "desconocida";
  const { success } = await c.env.AUTH_LIMITER.limit({ key: ip });
  if (!success) throw rateLimited("Demasiados intentos. Espera un minuto.");
  await next();
});

const MESSAGES: Record<MobileLoginError | "ok", string> = {
  ok: "Listo. Volviendo a Nuestro Lugar…",
  forbidden: "Esta cuenta de Google no tiene acceso. Este lugar es privado.",
  cancelled: "Cancelaste el inicio de sesión.",
  expired: "Tardó demasiado. Vuelve a la app e inténtalo otra vez.",
  failed: "No se pudo iniciar sesión. Vuelve a la app e inténtalo otra vez.",
};

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

const REDIRECT_SCRIPT = `location.replace(document.getElementById("volver").href);`;

/** Página mínima que devuelve a la app por deep link (con botón por si el navegador no salta solo). */
async function returnPage(link: string, message: string): Promise<{ html: string; csp: string }> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(REDIRECT_SCRIPT));
  const scriptHash = btoa(String.fromCharCode(...new Uint8Array(digest)));
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nuestro Lugar</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff7f9;color:#3d2c2e;font:16px system-ui,sans-serif;text-align:center}
main{max-width:22rem;padding:2rem}a{display:inline-block;margin-top:1.25rem;padding:.8rem 1.4rem;border-radius:999px;background:#eaa5b4;color:#3d2c2e;font-weight:600;text-decoration:none}</style>
</head><body><main><p>${escapeHtml(message)}</p><a id="volver" href="${escapeHtml(link)}">Volver a la app</a></main>
<script>${REDIRECT_SCRIPT}</script></body></html>`;
  return { html, csp: `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${scriptHash}'` };
}

export const mobileAuthRoutes = new Hono<AppEnv>()
  .get("/start", limitAuth, async (c) => {
    const { challenge } = parseQuery(c, mobileStartQuerySchema);
    const origin = new URL(c.req.url).origin;
    return c.redirect(await startMobileLogin(c.env, origin, challenge), 302);
  })
  .get("/callback", limitAuth, async (c) => {
    const origin = new URL(c.req.url).origin;
    const result = await completeMobileLogin(c.env, origin, {
      state: c.req.query("state"),
      code: c.req.query("code"),
      error: c.req.query("error"),
    });
    const link = result.ok ? `${APP_DEEP_LINK}?code=${encodeURIComponent(result.code)}` : `${APP_DEEP_LINK}?error=${result.error}`;
    const page = await returnPage(link, MESSAGES[result.ok ? "ok" : result.error]);
    c.header("content-security-policy", page.csp);
    c.header("cache-control", "no-store");
    c.header("referrer-policy", "no-referrer");
    return c.html(page.html);
  })
  .post("/token", limitAuth, async (c) => {
    const input = await parseJsonBody(c, mobileTokenSchema);
    return c.json(await redeemLoginCode(c.env, input));
  })
  .post("/refresh", limitAuth, async (c) => {
    const input = await parseJsonBody(c, mobileRefreshSchema);
    return c.json(await refreshMobileSession(c.env, input.refreshToken));
  })
  .post("/logout", requireUser, async (c) => {
    const sessionId = c.get("mobileSessionId");
    if (sessionId) await logoutMobileSession(c.env, sessionId);
    return c.body(null, 204);
  });
