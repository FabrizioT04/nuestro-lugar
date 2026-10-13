/// <reference types="node" />
import { createECDH, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { compactVerify, importJWK } from "jose";
import { describe, expect, it, vi } from "vitest";
import { base64url } from "../auth/mobileTokens";
import { base64urlDecode, encryptPayload, isAllowedPushEndpoint, sendPush, usableVapidKeys, vapidAuthorization, type VapidKeys } from "./webPush";

// http_ece es la implementación de referencia de aes128gcm (de uno de los autores del RFC):
// si descifra lo que cifra el Worker, el navegador también podrá.
const ece = createRequire(import.meta.url)("http_ece") as {
  decrypt(buffer: Buffer, params: Record<string, unknown>): Buffer;
};

/** Un "navegador" de mentira: su par de claves y su secreto de autenticación. */
function browser() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16);
  return { ecdh, subscription: { p256dh: base64url(ecdh.getPublicKey()), auth: base64url(auth) }, auth };
}

function decrypt(body: Uint8Array, b: ReturnType<typeof browser>) {
  const buffer = Buffer.from(body);
  const keyLength = buffer[20]!;
  return ece
    .decrypt(buffer, { version: "aes128gcm", privateKey: b.ecdh, dh: base64url(buffer.subarray(21, 21 + keyLength)), authSecret: base64url(b.auth) })
    .toString("utf8");
}

async function vapidKeys(): Promise<VapidKeys> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])) as CryptoKeyPair;
  const raw = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  return { publicKey: base64url(raw), privateKey: jwk.d!, subject: "https://app.nuestro-lugar.workers.dev" };
}

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";

describe("encryptPayload", () => {
  it("cifra en aes128gcm y el navegador lo descifra igual", async () => {
    const b = browser();
    const payload = JSON.stringify({ title: "Zuleyka te escribió una carta 💌", body: "Ábrela cuando quieras", url: "/cartas/1" });
    const body = await encryptPayload(b.subscription, payload);

    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    expect(body[20]).toBe(65);
    expect(decrypt(body, b)).toBe(payload);
  });

  it("cada envío usa claves y sal nuevas (dos cifrados del mismo texto no se parecen)", async () => {
    const b = browser();
    const [one, two] = await Promise.all([encryptPayload(b.subscription, "hola"), encryptPayload(b.subscription, "hola")]);
    expect(base64url(one)).not.toBe(base64url(two));
  });

  it("otro navegador no puede descifrarlo", async () => {
    const body = await encryptPayload(browser().subscription, "secreto");
    expect(() => decrypt(body, browser())).toThrow();
  });

  it("rechaza claves inválidas y textos demasiado largos", async () => {
    const b = browser();
    await expect(encryptPayload({ p256dh: "corta", auth: b.subscription.auth }, "x")).rejects.toThrow();
    await expect(encryptPayload(b.subscription, "x".repeat(4000))).rejects.toThrow("demasiado largo");
  });
});

describe("vapidAuthorization", () => {
  it("firma un JWT ES256 para el origen del servicio de push, válido 12 h", async () => {
    const keys = await vapidKeys();
    const now = Date.UTC(2026, 9, 13, 12);
    const header = await vapidAuthorization(ENDPOINT, keys, now);
    const match = /^vapid t=([^,]+), k=(.+)$/.exec(header);
    expect(match?.[2]).toBe(keys.publicKey);

    const pub = base64urlDecode(keys.publicKey);
    const key = await importJWK({ kty: "EC", crv: "P-256", x: base64url(pub.slice(1, 33)), y: base64url(pub.slice(33)) }, "ES256");
    const { payload } = await compactVerify(match![1]!, key);
    const claims = JSON.parse(new TextDecoder().decode(payload));
    expect(claims).toEqual({ aud: "https://fcm.googleapis.com", exp: now / 1000 + 12 * 3600, sub: keys.subject });
  });
});

describe("isAllowedPushEndpoint", () => {
  it("solo acepta servicios de push conocidos por https", () => {
    expect(isAllowedPushEndpoint(ENDPOINT)).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QG")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-db5p.notify.windows.com/w/?token=x")).toBe(true);
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://evil.com/fcm.googleapis.com")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://user@fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("no es una url")).toBe(false);
  });
});

describe("usableVapidKeys", () => {
  it("exige las dos claves con su largo correcto", async () => {
    const keys = await vapidKeys();
    expect(usableVapidKeys(keys.publicKey, keys.privateKey)).toBe(true);
    expect(usableVapidKeys(keys.publicKey, undefined)).toBe(false);
    expect(usableVapidKeys(keys.privateKey, keys.publicKey)).toBe(false);
    expect(usableVapidKeys("@@@", keys.privateKey)).toBe(false);
  });
});

describe("sendPush", () => {
  it("manda el aviso cifrado con los encabezados de Web Push", async () => {
    const b = browser();
    const keys = await vapidKeys();
    const fetcher = vi.fn(async () => new Response(null, { status: 201 }));
    const result = await sendPush({ endpoint: ENDPOINT, ...b.subscription }, "hola", keys, { ttl: 3600 }, fetcher as typeof fetch);

    expect(result).toEqual({ ok: true });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Encoding"]).toBe("aes128gcm");
    expect(headers.TTL).toBe("3600");
    expect(headers.Authorization).toMatch(/^vapid t=/);
    expect(decrypt(init.body as Uint8Array, b)).toBe("hola");
  });

  it("404 y 410 significan que la suscripción ya no existe", async () => {
    const keys = await vapidKeys();
    const sub = { endpoint: ENDPOINT, ...browser().subscription };
    for (const status of [404, 410]) {
      const result = await sendPush(sub, "x", keys, { ttl: 60 }, (async () => new Response(null, { status })) as typeof fetch);
      expect(result).toEqual({ ok: false, gone: true, status });
    }
    const busy = await sendPush(sub, "x", keys, { ttl: 60 }, (async () => new Response(null, { status: 429 })) as typeof fetch);
    expect(busy).toEqual({ ok: false, gone: false, status: 429 });
    const offline = await sendPush(sub, "x", keys, { ttl: 60 }, (async () => { throw new TypeError("network"); }) as typeof fetch);
    expect(offline).toEqual({ ok: false, gone: false, status: 0 });
  });

  it("no hace ninguna petición a URLs que no son servicios de push", async () => {
    const fetcher = vi.fn();
    const result = await sendPush({ endpoint: "https://evil.com/x", ...browser().subscription }, "x", await vapidKeys(), { ttl: 60 }, fetcher as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
