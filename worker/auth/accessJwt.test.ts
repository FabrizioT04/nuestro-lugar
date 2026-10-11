import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey } from "jose";
import { AccessTokenError, normalizeTeamDomain, verifyAccessJwt } from "./accessJwt";

const config = { teamDomain: "https://equipo.cloudflareaccess.com", audience: "aud-123" };

let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;
let jwks: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  otherPrivateKey = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  jwks = createLocalJWKSet({ keys: [jwk] });
});

function sign(claims: Record<string, unknown>, opts: { key?: CryptoKey; iss?: string; aud?: string; exp?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.iss ?? config.teamDomain)
    .setAudience(opts.aud ?? config.audience)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "5m")
    .sign(opts.key ?? privateKey);
}

describe("verifyAccessJwt", () => {
  it("devuelve el correo en minúsculas de un token válido", async () => {
    const token = await sign({ email: "Ana@Example.com" });
    await expect(verifyAccessJwt(token, config, jwks)).resolves.toBe("ana@example.com");
  });

  it.each([
    ["firma de otra clave", { key: "other" }],
    ["audiencia equivocada", { aud: "otra-app" }],
    ["emisor equivocado", { iss: "https://otro.cloudflareaccess.com" }],
    ["token expirado", { exp: "-1m" }],
  ])("rechaza %s", async (_name, variant) => {
    const token = await sign(
      { email: "ana@example.com" },
      {
        key: "key" in variant ? otherPrivateKey : undefined,
        aud: "aud" in variant ? variant.aud : undefined,
        iss: "iss" in variant ? variant.iss : undefined,
        exp: "exp" in variant ? variant.exp : undefined,
      },
    );
    await expect(verifyAccessJwt(token, config, jwks)).rejects.toBeInstanceOf(AccessTokenError);
  });

  it("rechaza un token sin correo", async () => {
    const token = await sign({ sub: "service-token" });
    await expect(verifyAccessJwt(token, config, jwks)).rejects.toThrow("no contiene un correo");
  });

  it("rechaza texto que no es un JWT", async () => {
    await expect(verifyAccessJwt("no-es-un-token", config, jwks)).rejects.toBeInstanceOf(AccessTokenError);
  });
});

describe("normalizeTeamDomain", () => {
  it("añade https y quita la barra final", () => {
    expect(normalizeTeamDomain("equipo.cloudflareaccess.com/")).toBe("https://equipo.cloudflareaccess.com");
    expect(normalizeTeamDomain("https://equipo.cloudflareaccess.com")).toBe("https://equipo.cloudflareaccess.com");
  });
});
