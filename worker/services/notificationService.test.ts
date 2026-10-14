/// <reference types="node" />
import { createECDH, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LetterDetail } from "@shared/api";
import type { AuthenticatedUser } from "../auth/types";
import { base64url } from "../auth/mobileTokens";
import type { Bindings } from "../env";
import { createPushRepository } from "../repositories/pushRepository";
import { createFakeD1 } from "../testing/fakeD1";
import { deliver, getPushConfig, notifyNewLetter, notifyNewMemory, subscribe } from "./notificationService";
import { anniversaryNotices, runReminders } from "./reminderService";

let env: Bindings;
let pushes: { endpoint: string }[];
/** El servicio de push de mentira: responde 201, o lo que diga `responses` para un endpoint. */
let responses: Record<string, number>;
const fetcher = (async (url: string) => {
  pushes.push({ endpoint: url });
  return new Response(null, { status: responses[url] ?? 201 });
}) as unknown as typeof fetch;

const fabri: AuthenticatedUser = { id: "u1", email: "f@x.com", displayName: "Fabrizio", introSeenAt: null, relationshipId: "r1" };
const endpointOf = (user: string, n = 1) => `https://fcm.googleapis.com/fcm/send/${user}-${n}`;

async function vapid() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])) as CryptoKeyPair;
  const raw = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  return { VAPID_PUBLIC_KEY: base64url(raw), VAPID_PRIVATE_KEY: ((await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey).d! };
}

async function addDevice(userId: string, n = 1) {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  await createPushRepository(env.DB).upsertSubscription(userId, endpointOf(userId, n), base64url(ecdh.getPublicKey()), base64url(randomBytes(16)));
}

const sentTo = () => pushes.map((p) => p.endpoint).sort();

beforeEach(async () => {
  env = { DB: createFakeD1(), ...(await vapid()) } as unknown as Bindings;
  pushes = [];
  responses = {};
  await env.DB.exec(`INSERT INTO users (id, email, display_name) VALUES ('u1','f@x.com','Fabrizio'), ('u2','z@x.com','Zuleyka'), ('u3','o@x.com','Otra')`);
  await env.DB.exec(`INSERT INTO relationships (id, started_on, timezone) VALUES ('r1','2024-03-15','America/Lima'), ('r2','2020-01-01','UTC')`);
  await env.DB.exec(`INSERT INTO relationship_members (relationship_id, user_id) VALUES ('r1','u1'), ('r1','u2'), ('r2','u3')`);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const notice = (key = "k1") => ({ key, category: "memories" as const, payload: { title: "t", body: "b", url: "/", tag: "x" } });

describe("deliver", () => {
  it("llega a todos los dispositivos de la persona y una sola vez por clave", async () => {
    await addDevice("u2", 1);
    await addDevice("u2", 2);
    await addDevice("u1");
    expect(await deliver(env, ["u2"], notice(), fetcher)).toBe(2);
    expect(sentTo()).toEqual([endpointOf("u2", 1), endpointOf("u2", 2)]);

    expect(await deliver(env, ["u2"], notice(), fetcher)).toBe(0);
    expect(pushes).toHaveLength(2);
  });

  it("respeta los avisos que cada persona apagó", async () => {
    await addDevice("u2");
    await createPushRepository(env.DB).setPreferences("u2", { letters: true, memories: false, capsules: true, dates: true, plans: true, drawings: true, songs: true });
    expect(await deliver(env, ["u2"], notice(), fetcher)).toBe(0);
    expect(pushes).toHaveLength(0);
  });

  it("olvida los dispositivos que el servicio de push da por muertos (410) y guarda los demás", async () => {
    await addDevice("u2", 1);
    await addDevice("u2", 2);
    responses[endpointOf("u2", 1)] = 410;
    responses[endpointOf("u2", 2)] = 500;
    await deliver(env, ["u2"], notice(), fetcher);
    const left = await createPushRepository(env.DB).listSubscriptions(["u2"]);
    expect(left.map((s) => s.endpoint)).toEqual([endpointOf("u2", 2)]);
  });

  it("sin claves VAPID no hace nada (y no gasta la clave del aviso)", async () => {
    await addDevice("u2");
    const noKeys = { DB: env.DB } as unknown as Bindings;
    expect(await deliver(noKeys, ["u2"], notice(), fetcher)).toBe(0);
    expect(await deliver(env, ["u2"], notice(), fetcher)).toBe(1);
  });
});

describe("suscripciones", () => {
  it("rechaza URLs que no son de un servicio de push y limita a 10 dispositivos por persona", async () => {
    await expect(subscribe(env, fabri, "https://evil.com/push", "x".repeat(87), "y".repeat(22))).rejects.toThrow("servicio de avisos");
    for (let n = 1; n <= 12; n++) await addDevice("u1", n);
    expect(await createPushRepository(env.DB).listSubscriptions(["u1"])).toHaveLength(10);
  });

  it("la configuración entrega solo la clave pública", async () => {
    const config = await getPushConfig(env, fabri);
    expect(config.enabled).toBe(true);
    expect(config.publicKey).toBe(env.VAPID_PUBLIC_KEY);
    expect(JSON.stringify(config)).not.toContain(env.VAPID_PRIVATE_KEY!);
    expect(config.preferences.letters).toBe(true);
  });
});

describe("avisos al instante", () => {
  const letter = (patch: Partial<LetterDetail>): LetterDetail =>
    ({ id: "l1", type: "normal", title: "Secreto", openWhenLabel: null, unlockAt: null, isLocked: false, recipient: { id: "u2", displayName: "Zuleyka" }, ...patch }) as LetterDetail;

  it("carta nueva: avisa solo a quien la recibe; las sorpresas no se anuncian", async () => {
    await addDevice("u1");
    await addDevice("u2");
    await notifyNewLetter(env, fabri, letter({}), fetcher);
    expect(sentTo()).toEqual([endpointOf("u2")]);

    pushes = [];
    await notifyNewLetter(env, fabri, letter({ id: "l2", type: "surprise", isLocked: true, unlockAt: "2027-01-01T05:00:00.000Z" }), fetcher);
    expect(pushes).toHaveLength(0);
  });

  it("recuerdo nuevo: avisa a la otra persona", async () => {
    await addDevice("u1");
    await addDevice("u2");
    await notifyNewMemory(env, fabri, { id: "m1", title: "Patos y patas" } as never, fetcher);
    expect(sentTo()).toEqual([endpointOf("u2")]);
  });
});

describe("avisos programados", () => {
  // 13 de octubre de 2026, 10:00 en Lima (15:00 UTC).
  const MORNING = new Date("2026-10-13T15:00:00.000Z");

  beforeEach(async () => {
    await addDevice("u1");
    await addDevice("u2");
    await addDevice("u3");
  });

  it("carta programada que llegó a su fecha: avisa al destinatario una sola vez", async () => {
    await env.DB.exec(`INSERT INTO letters (id, relationship_id, author_id, recipient_id, letter_type, title, body, unlock_at) VALUES
      ('due','r1','u1','u2','scheduled','t','b','2026-10-13T14:00:00.000Z'),
      ('future','r1','u1','u2','scheduled','t','b','2026-10-14T14:00:00.000Z'),
      ('old','r1','u1','u2','scheduled','t','b','2026-09-01T14:00:00.000Z')`);
    await env.DB.exec(`INSERT INTO letters (id, relationship_id, author_id, recipient_id, letter_type, title, body, unlock_at, opened_at) VALUES
      ('opened','r1','u1','u2','scheduled','t','b','2026-10-13T14:00:00.000Z','2026-10-13T14:30:00.000Z')`);
    // A las 3 a. m. de Lima: las cartas sí se avisan a cualquier hora (llegaron a su fecha).
    const night = new Date("2026-10-13T08:00:00.000Z");
    await env.DB.exec(`UPDATE letters SET unlock_at = '2026-10-13T07:00:00.000Z' WHERE id = 'due'`);
    expect(await runReminders(env, night, fetcher)).toBe(1);
    expect(sentTo()).toEqual([endpointOf("u2")]);
    expect(await runReminders(env, night, fetcher)).toBe(0);
  });

  it("cápsula para los dos que ya se puede abrir: avisa a los dos", async () => {
    await env.DB.exec(`INSERT INTO future_capsules (id, relationship_id, created_by, title, unlock_at) VALUES ('c1','r1','u1','Para el futuro','2026-10-13T14:00:00.000Z')`);
    expect(await runReminders(env, MORNING, fetcher)).toBe(2);
    expect(sentTo()).toEqual([endpointOf("u1"), endpointOf("u2")]);
  });

  it("de día: fechas de hoy y de mañana y planes de hoy; de noche no", async () => {
    await env.DB.exec(`INSERT INTO important_dates (id, relationship_id, created_by, title, date_type, event_date) VALUES
      ('bday','r1','u1','Cumple de Zuleyka','birthday','2001-10-13'),
      ('eve','r1','u1','Primer viaje','trip','2025-10-14'),
      ('other','r1','u1','Otra cosa','custom','2025-12-01')`);
    await env.DB.exec(`INSERT INTO plans (id, relationship_id, created_by, title, planned_for) VALUES
      ('p1','r1','u1','Cine','2026-10-13'), ('p2','r1','u1','Mañana','2026-10-14')`);

    const night = new Date("2026-10-13T06:00:00.000Z"); // 1 a. m. en Lima
    expect(await runReminders(env, night, fetcher)).toBe(0);

    // 3 avisos (cumple, víspera, plan) × 2 personas.
    expect(await runReminders(env, MORNING, fetcher)).toBe(6);
    expect(await runReminders(env, new Date("2026-10-13T20:00:00.000Z"), fetcher)).toBe(0);
  });
});

describe("anniversaryNotices", () => {
  const rel = { id: "r1", started_on: "2024-03-15", timezone: "America/Lima" };
  const titles = (today: string) => anniversaryNotices(rel, today).map((n) => n.payload.title);

  it("aniversario, víspera y mesiversario", () => {
    expect(titles("2026-03-15")).toEqual(["💞 Hoy cumplen 2 años juntos"]);
    expect(titles("2025-03-15")).toEqual(["💞 Hoy es su primer aniversario"]);
    expect(titles("2026-03-14")).toEqual(["💞 Mañana es su aniversario"]);
    expect(titles("2024-04-15")).toEqual(["💗 Hoy cumplen 1 mes juntos"]);
    expect(titles("2026-10-15")).toEqual(["💗 Hoy cumplen 2 años y 7 meses juntos"]);
    expect(titles("2026-10-13")).toEqual([]);
    expect(titles("2024-03-15")).toEqual([]);
  });

  it("si empezaron un 31, el mesiversario de un mes corto es su último día", () => {
    expect(anniversaryNotices({ ...rel, started_on: "2026-01-31" }, "2026-02-28").map((n) => n.payload.title)).toEqual(["💗 Hoy cumplen 1 mes juntos"]);
  });
});
