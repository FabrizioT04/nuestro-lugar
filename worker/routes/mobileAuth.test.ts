import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MobileSessionResponse } from "@shared/api";
import type { Bindings } from "../env";
import { pkceChallenge } from "../auth/mobileTokens";
import { createFakeD1 } from "../testing/fakeD1";
import { app } from "../index";

// Flujo completo de la app móvil contra el Worker real (Hono + D1 de mentira).
// Solo Google es de mentira: devuelve el correo que diga la prueba.
const google = vi.hoisted(() => ({ email: "ana@example.com" }));
vi.mock("../auth/googleOAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../auth/googleOAuth")>()),
  exchangeGoogleCode: vi.fn(async () => google.email),
}));

const ORIGIN = "https://app-movil.nuestro-lugar.workers.dev";
const VERIFIER = "v".repeat(50);
const MEDIA_ID = "6f1c2a7e-0d3b-4a8e-9c5f-2b7d1e4a9c30";

let env: Bindings;
let limiterCalls: number;

function mobileEnv(overrides: Partial<Bindings> = {}): Bindings {
  limiterCalls = 0;
  const limiter = { limit: async () => ({ success: true }) };
  return {
    DB: createFakeD1(),
    ENVIRONMENT: "production",
    AUTH_MODE: "mobile",
    ALLOWED_EMAILS: "ana@example.com, beto@example.com",
    GOOGLE_OAUTH_CLIENT_ID: "cliente.apps.googleusercontent.com",
    GOOGLE_OAUTH_CLIENT_SECRET: "secreto-de-google",
    MOBILE_TOKEN_SECRET: "k".repeat(48),
    AUTH_LIMITER: {
      limit: async () => {
        limiterCalls++;
        return { success: true };
      },
    },
    WRITE_LIMITER: limiter,
    ...overrides,
  } as unknown as Bindings;
}

const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
const request = (path: string, init: RequestInit = {}, e: Bindings = env) => app.request(`${ORIGIN}/api${path}`, init, e, executionCtx);
const post = (path: string, body: unknown, e: Bindings = env) =>
  request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, e);
const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

/** Pasos 1–3: abrir /start, volver de Google y leer el código del deep link. */
async function loginCode(e: Bindings = env): Promise<{ code: string | null; error: string | null }> {
  const start = await request(`/auth/mobile/start?challenge=${await pkceChallenge(VERIFIER)}`, {}, e);
  expect(start.status).toBe(302);
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const callback = await request(`/auth/mobile/callback?state=${state}&code=codigo-de-google`, {}, e);
  expect(callback.status).toBe(200);
  const link = (await callback.text()).match(/href="(nuestrolugar:\/\/auth\?[^"]+)"/)![1]!;
  const params = new URL(link.replace(/&amp;/g, "&")).searchParams;
  return { code: params.get("code"), error: params.get("error") };
}

async function login(): Promise<MobileSessionResponse> {
  const { code } = await loginCode();
  const res = await post("/auth/mobile/token", { code, verifier: VERIFIER });
  expect(res.status).toBe(200);
  return res.json();
}

async function joinRelationship(email: string) {
  await env.DB.prepare("INSERT INTO relationships (id, started_on) VALUES ('r1', '2026-02-01')").run();
  await env.DB.prepare("INSERT INTO relationship_members (relationship_id, user_id) SELECT 'r1', id FROM users WHERE email = ?1").bind(email).run();
}

beforeEach(() => {
  google.email = "ana@example.com";
  env = mobileEnv();
});

describe("inicio de sesión de la app móvil", () => {
  it("manda a Google con state, nonce y PKCE, y el callback va a este mismo Worker", async () => {
    const res = await request(`/auth/mobile/start?challenge=${await pkceChallenge(VERIFIER)}`);
    const url = new URL(res.headers.get("location")!);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/mobile/callback`);
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get("nonce")).toBeTruthy();
    expect(limiterCalls).toBe(1);
  });

  it("rechaza /start sin desafío PKCE", async () => {
    expect((await request("/auth/mobile/start")).status).toBe(400);
  });

  it("flujo completo: deep link → tokens → /me con el token de acceso", async () => {
    const tokens = await login();
    expect(tokens.refreshToken).toHaveLength(43);
    const me = await request("/me", bearer(tokens.accessToken));
    expect(me.status).toBe(200);
    expect(((await me.json()) as { user: { email: string } }).user.email).toBe("ana@example.com");
  });

  it("la página de regreso no deja ejecutar otros scripts (CSP) y no se guarda en caché", async () => {
    const start = await request(`/auth/mobile/start?challenge=${await pkceChallenge(VERIFIER)}`);
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const res = await request(`/auth/mobile/callback?state=${state}&code=x`);
    expect(res.headers.get("content-security-policy")).toMatch(/default-src 'none'; .*script-src 'sha256-/);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("un correo que no está en la lista vuelve a la app con error y no crea usuario", async () => {
    google.email = "intruso@example.com";
    expect(await loginCode()).toEqual({ code: null, error: "forbidden" });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first()).toEqual({ n: 0 });
  });

  it("si la persona cancela en Google, la app recibe 'cancelled'", async () => {
    const res = await request("/auth/mobile/callback?error=access_denied&state=x");
    expect(await res.text()).toContain("nuestrolugar://auth?error=cancelled");
  });

  it("un state inventado o ya usado no sirve", async () => {
    const res = await request("/auth/mobile/callback?state=inventado&code=x");
    expect(await res.text()).toContain("error=failed");
  });

  it("el código del deep link no sirve sin el verificador correcto (otra app que lo intercepte)", async () => {
    const { code } = await loginCode();
    expect((await post("/auth/mobile/token", { code, verifier: "w".repeat(50) })).status).toBe(401);
  });

  it("el código del deep link se usa una sola vez", async () => {
    const { code } = await loginCode();
    expect((await post("/auth/mobile/token", { code, verifier: VERIFIER })).status).toBe(200);
    expect((await post("/auth/mobile/token", { code, verifier: VERIFIER })).status).toBe(401);
  });

  it("el código del deep link vence a los 2 minutos", async () => {
    const { code } = await loginCode();
    await env.DB.prepare("UPDATE mobile_login_requests SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    expect((await post("/auth/mobile/token", { code, verifier: VERIFIER })).status).toBe(401);
  });

  it("sin configuración de Google responde 500 sin decir qué falta", async () => {
    const e = mobileEnv({ GOOGLE_OAUTH_CLIENT_SECRET: undefined });
    const res = await request(`/auth/mobile/start?challenge=${await pkceChallenge(VERIFIER)}`, {}, e);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("GOOGLE");
  });

  it("respeta el límite de intentos por IP", async () => {
    const e = mobileEnv({ AUTH_LIMITER: { limit: async () => ({ success: false }) } as unknown as RateLimit });
    expect((await request(`/auth/mobile/start?challenge=${await pkceChallenge(VERIFIER)}`, {}, e)).status).toBe(429);
  });
});

describe("refresh y cierre de sesión", () => {
  it("el refresh token rota: el nuevo sirve y el anterior queda inválido pasado un momento", async () => {
    const first = await login();
    const res = await post("/auth/mobile/refresh", { refreshToken: first.refreshToken });
    expect(res.status).toBe(200);
    const second = (await res.json()) as MobileSessionResponse;
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect((await request("/me", bearer(second.accessToken))).status).toBe(200);

    // Reusar el anterior después del margen = alguien lo copió: se cierra toda la sesión.
    await env.DB.prepare("UPDATE mobile_sessions SET rotated_at = '2000-01-01T00:00:00.000Z'").run();
    expect((await post("/auth/mobile/refresh", { refreshToken: first.refreshToken })).status).toBe(401);
    expect((await post("/auth/mobile/refresh", { refreshToken: second.refreshToken })).status).toBe(401);
    expect((await request("/me", bearer(second.accessToken))).status).toBe(401);
  });

  it("si la respuesta del refresh se perdió, reintentar enseguida con el token anterior funciona", async () => {
    const first = await login();
    await post("/auth/mobile/refresh", { refreshToken: first.refreshToken });
    const retry = await post("/auth/mobile/refresh", { refreshToken: first.refreshToken });
    expect(retry.status).toBe(200);
  });

  it("cerrar sesión invalida el token de acceso, el de fotos y el refresh token", async () => {
    const tokens = await login();
    await joinRelationship("ana@example.com");
    expect((await request("/auth/mobile/logout", { method: "POST", ...bearer(tokens.accessToken) })).status).toBe(204);
    expect((await request("/me", bearer(tokens.accessToken))).status).toBe(401);
    expect((await request(`/media/${MEDIA_ID}?mt=${tokens.mediaToken}`)).status).toBe(401);
    expect((await post("/auth/mobile/refresh", { refreshToken: tokens.refreshToken })).status).toBe(401);
  });

  it("si sacan un correo de la lista, su sesión deja de funcionar", async () => {
    const tokens = await login();
    const e = mobileEnv({ DB: env.DB, ALLOWED_EMAILS: "beto@example.com" });
    expect((await request("/me", bearer(tokens.accessToken), e)).status).toBe(401);
    expect((await post("/auth/mobile/refresh", { refreshToken: tokens.refreshToken }, e)).status).toBe(401);
  });
});

describe("puertas de entrada", () => {
  it("el token de fotos solo abre fotos y audios", async () => {
    const tokens = await login();
    await joinRelationship("ana@example.com");
    const photo = await request(`/media/${MEDIA_ID}?size=thumb&mt=${tokens.mediaToken}`);
    expect(photo.status).toBe(404); // pasó la autenticación; la foto no existe
    expect((await request(`/memories?mt=${tokens.mediaToken}`)).status).toBe(401);
    expect((await request(`/media/${MEDIA_ID}`, bearer(tokens.mediaToken))).status).toBe(401);
  });

  it("el Worker móvil no acepta peticiones sin token ni la cabecera de Access", async () => {
    expect((await request("/me")).status).toBe(401);
    expect((await request("/me", { headers: { "cf-access-jwt-assertion": "x" } })).status).toBe(401);
  });

  it("el Worker web (Access) no acepta tokens de la app ni tiene rutas de login móvil", async () => {
    const tokens = await login();
    const web = mobileEnv({ DB: env.DB, AUTH_MODE: undefined, ACCESS_TEAM_DOMAIN: "https://equipo.cloudflareaccess.com", ACCESS_AUD: "aud" });
    expect((await request("/me", bearer(tokens.accessToken), web)).status).toBe(401);
    expect((await request(`/auth/mobile/start?challenge=${await pkceChallenge(VERIFIER)}`, {}, web)).status).toBe(404);
  });

  it("CORS: permite la app (https://localhost) y no otros sitios", async () => {
    const preflight = (origin: string, e = env) =>
      request("/me", { method: "OPTIONS", headers: { origin, "access-control-request-method": "GET", "access-control-request-headers": "authorization" } }, e);
    expect((await preflight("https://localhost")).headers.get("access-control-allow-origin")).toBe("https://localhost");
    expect((await preflight("https://otro-sitio.com")).headers.get("access-control-allow-origin")).toBeNull();
    const web = mobileEnv({ AUTH_MODE: undefined });
    expect((await preflight("https://localhost", web)).headers.get("access-control-allow-origin")).toBeNull();
  });

  it("en el Worker móvil /api/health/db no está disponible", async () => {
    expect((await request("/health/db")).status).toBe(404);
  });
});
