import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey } from "jose";
import { GoogleOAuthError, googleAuthorizeUrl, verifyGoogleIdToken } from "./googleOAuth";
import {
  MobileTokenError,
  pkceChallenge,
  safeEqual,
  signAccessToken,
  signMediaToken,
  usableSecret,
  verifyMobileToken,
} from "./mobileTokens";

const SECRET = "s".repeat(40);
const claims = { userId: "u1", sessionId: "sess-1", email: "ana@example.com" };
const NOW = Date.UTC(2026, 9, 13, 12);

describe("tokens de la app móvil", () => {
  it("un token de acceso válido devuelve usuario, sesión y correo", async () => {
    const token = await signAccessToken(claims, SECRET, NOW);
    await expect(verifyMobileToken(token, "api", SECRET, NOW + 60_000)).resolves.toEqual(claims);
  });

  it("el token de acceso vence a los 15 minutos", async () => {
    const token = await signAccessToken(claims, SECRET, NOW);
    await expect(verifyMobileToken(token, "api", SECRET, NOW + 16 * 60_000)).rejects.toThrow("Token vencido");
  });

  it("no se puede usar un token de fotos como token de acceso, ni al revés", async () => {
    const media = await signMediaToken(claims, SECRET, NOW);
    const access = await signAccessToken(claims, SECRET, NOW);
    await expect(verifyMobileToken(media, "api", SECRET, NOW)).rejects.toBeInstanceOf(MobileTokenError);
    await expect(verifyMobileToken(access, "media", SECRET, NOW)).rejects.toBeInstanceOf(MobileTokenError);
  });

  it("rechaza tokens firmados con otra clave o alterados", async () => {
    const token = await signAccessToken(claims, "otra-clave".repeat(5), NOW);
    await expect(verifyMobileToken(token, "api", SECRET, NOW)).rejects.toThrow("Token inválido");
    const good = await signAccessToken(claims, SECRET, NOW);
    const [h, , s] = good.split(".");
    const forged = `${h}.${btoa(JSON.stringify({ sub: "u2", sid: "x", email: "x@y.com", aud: "api", iss: "nuestro-lugar" }))}.${s}`;
    await expect(verifyMobileToken(forged, "api", SECRET, NOW)).rejects.toThrow("Token inválido");
  });

  it("el token de fotos es el mismo durante la semana (las URLs no cambian) y dura al menos una semana", async () => {
    const week = 7 * 24 * 3600 * 1000;
    const windowStart = Math.floor(NOW / week) * week;
    const a = await signMediaToken(claims, SECRET, windowStart + 1000);
    const b = await signMediaToken(claims, SECRET, windowStart + week - 1000);
    const c = await signMediaToken(claims, SECRET, windowStart + week + 1000);
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    await expect(verifyMobileToken(b, "media", SECRET, windowStart + 2 * week - 1000)).resolves.toEqual(claims);
    await expect(verifyMobileToken(b, "media", SECRET, windowStart + 2 * week + 1000)).rejects.toThrow("Token vencido");
  });

  it("exige un secreto de al menos 32 caracteres", () => {
    expect(usableSecret(undefined)).toBe(false);
    expect(usableSecret("corto")).toBe(false);
    expect(usableSecret(SECRET)).toBe(true);
  });

  it("calcula el desafío PKCE S256 como el ejemplo del RFC 7636", async () => {
    await expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).resolves.toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("safeEqual compara textos", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("ID token de Google", () => {
  let privateKey: CryptoKey;
  let jwks: JWTVerifyGetKey;
  const expected = { clientId: "cliente.apps.googleusercontent.com", nonce: "n-123" };

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: "g1", alg: "RS256" }] });
  });

  const idToken = (overrides: Record<string, unknown> = {}, aud = expected.clientId) =>
    new SignJWT({ email: "Ana@Gmail.com", email_verified: true, nonce: expected.nonce, ...overrides })
      .setProtectedHeader({ alg: "RS256", kid: "g1" })
      .setIssuer("https://accounts.google.com")
      .setAudience(aud)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);

  it("devuelve el correo verificado en minúsculas", async () => {
    await expect(verifyGoogleIdToken(await idToken(), expected, jwks)).resolves.toBe("ana@gmail.com");
  });

  it.each([
    ["otro nonce", { nonce: "otro" }, undefined],
    ["correo sin verificar", { email_verified: false }, undefined],
    ["token para otra aplicación", {}, "otra-app"],
  ])("rechaza %s", async (_name, overrides, aud) => {
    await expect(verifyGoogleIdToken(await idToken(overrides, aud), expected, jwks)).rejects.toBeInstanceOf(GoogleOAuthError);
  });

  it("pide solo identidad y usa PKCE", () => {
    const url = new URL(googleAuthorizeUrl({ clientId: "c", redirectUri: "https://x/cb" }, { state: "s", nonce: "n", codeChallenge: "ch" }));
    expect(url.searchParams.get("scope")).toBe("openid email");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe("https://x/cb");
  });
});
