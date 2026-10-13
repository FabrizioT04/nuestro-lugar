import type { CapsuleDetail, LetterDetail, MemoryDetail, PushConfigResponse, PushPayload, PushPreferences } from "@shared/api";
import type { Context } from "hono";
import type { AuthenticatedUser } from "../auth/types";
import type { AppEnv, Bindings } from "../env";
import { isAllowedPushEndpoint, sendPush, usableVapidKeys, type VapidKeys } from "../push/webPush";
import { createPushRepository } from "../repositories/pushRepository";
import { createRelationshipRepository } from "../repositories/relationshipRepository";
import { badRequest, serviceUnavailable } from "../utils/errors";

// Avisos push (fase 13). Todo lo decide el Worker: a quién, cuándo y qué dice el aviso.
// Los avisos nunca llevan el contenido privado (el texto de una carta o de una cápsula), solo
// quién y qué, porque se ven en la pantalla bloqueada.

export type PushCategory = keyof PushPreferences;

/** Por defecto el servicio de push guarda el aviso un día si el teléfono está apagado. */
const DEFAULT_TTL = 24 * 3600;

export function vapidKeys(env: Bindings): VapidKeys | null {
  if (!usableVapidKeys(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)) return null;
  return {
    publicKey: env.VAPID_PUBLIC_KEY!,
    privateKey: env.VAPID_PRIVATE_KEY!,
    subject: env.VAPID_SUBJECT?.trim() || "https://app.nuestro-lugar.workers.dev",
  };
}

export interface Notice {
  /** Clave única del aviso: si ya se envió, no se repite. */
  key: string;
  category: PushCategory;
  payload: PushPayload;
  ttl?: number;
}

/**
 * Envía un aviso a esas personas (a todos sus dispositivos), respetando lo que cada una activó.
 * Nunca lanza: un aviso que falla no debe romper lo que lo provocó.
 */
export async function deliver(env: Bindings, userIds: string[], notice: Notice, fetcher: typeof fetch = fetch): Promise<number> {
  const keys = vapidKeys(env);
  if (!keys || userIds.length === 0) return 0;
  try {
    const repository = createPushRepository(env.DB);
    if (!(await repository.claim(notice.key))) return 0;

    const wanted: string[] = [];
    for (const userId of new Set(userIds)) {
      if ((await repository.getPreferences(userId))[notice.category]) wanted.push(userId);
    }
    const subscriptions = await repository.listSubscriptions(wanted);
    const body = JSON.stringify(notice.payload);
    const results = await Promise.all(
      subscriptions.map(async (sub) => ({ sub, result: await sendPush(sub, body, keys, { ttl: notice.ttl ?? DEFAULT_TTL }, fetcher) })),
    );

    const gone = results.filter(({ result }) => !result.ok && result.gone).map(({ sub }) => sub.id);
    for (const id of gone) await repository.deleteSubscriptionById(id);
    const delivered = results.filter(({ result }) => result.ok).map(({ sub }) => sub.id);
    await repository.markDelivered(delivered, new Date().toISOString());
    const failed = results.filter(({ result }) => !result.ok && !result.gone);
    if (failed.length > 0) console.warn("push: envíos fallidos", failed.map(({ result }) => (result.ok ? 0 : result.status)));
    return delivered.length;
  } catch (err) {
    console.error("push: no se pudo enviar el aviso", notice.key, err);
    return 0;
  }
}

/** Corre el envío después de responder, sin hacer esperar a quien guardó. */
export function inBackground(c: Context<AppEnv>, task: Promise<unknown>): void {
  try {
    c.executionCtx.waitUntil(task);
  } catch {
    // Sin ExecutionContext (pruebas): que termine por su cuenta.
    void task;
  }
}

function formatDay(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "long", timeZone: timezone }).format(new Date(iso));
}

async function timezoneOf(env: Bindings, relationshipId: string): Promise<string> {
  return (await createRelationshipRepository(env.DB).findSummary(relationshipId))?.timezone ?? "UTC";
}

// ---------------------------------------------------------------------------
// Avisos al instante (cuando la otra persona guarda algo)
// ---------------------------------------------------------------------------

export async function notifyNewLetter(env: Bindings, author: AuthenticatedUser, letter: LetterDetail, fetcher?: typeof fetch): Promise<void> {
  // Las sorpresas no existen para el destinatario hasta su fecha: el aviso llega ese día (cron).
  if (letter.type === "surprise") return;
  let body = "Ábrela cuando quieras 💌";
  if (letter.isLocked && letter.unlockAt) body = `Podrás abrirla el ${formatDay(letter.unlockAt, await timezoneOf(env, author.relationshipId!))}`;
  else if (letter.type === "open_when" && letter.openWhenLabel) body = `Para abrir cuando ${letter.openWhenLabel}`;
  await deliver(
    env,
    [letter.recipient.id],
    { key: `letter-new:${letter.id}`, category: "letters", payload: { title: `${author.displayName} te escribió una carta`, body, url: `/cartas/${letter.id}`, tag: `letter-${letter.id}` } },
    fetcher,
  );
}

export async function notifyNewMemory(env: Bindings, author: AuthenticatedUser, memory: MemoryDetail, fetcher?: typeof fetch): Promise<void> {
  const partnerId = await createRelationshipRepository(env.DB).findPartnerId(author.relationshipId!, author.id);
  if (!partnerId) return;
  await deliver(
    env,
    [partnerId],
    {
      key: `memory-new:${memory.id}`,
      category: "memories",
      payload: { title: `${author.displayName} guardó un recuerdo`, body: memory.title, url: `/recuerdos/${memory.id}`, tag: `memory-${memory.id}` },
    },
    fetcher,
  );
}

export async function notifyNewCapsule(env: Bindings, author: AuthenticatedUser, capsule: CapsuleDetail, fetcher?: typeof fetch): Promise<void> {
  const partnerId = await createRelationshipRepository(env.DB).findPartnerId(author.relationshipId!, author.id);
  if (!partnerId) return;
  const day = formatDay(capsule.unlockAt, await timezoneOf(env, author.relationshipId!));
  await deliver(
    env,
    [partnerId],
    {
      key: `capsule-new:${capsule.id}`,
      category: "capsules",
      payload: {
        title: `${author.displayName} guardó una cápsula del tiempo`,
        body: `“${capsule.title}” se abre el ${day} 🔒`,
        url: `/futuro/${capsule.id}`,
        tag: `capsule-${capsule.id}`,
      },
    },
    fetcher,
  );
}

// ---------------------------------------------------------------------------
// Suscripciones y preferencias (rutas /api/push)
// ---------------------------------------------------------------------------

export async function getPushConfig(env: Bindings, user: AuthenticatedUser): Promise<PushConfigResponse> {
  const keys = vapidKeys(env);
  return {
    enabled: keys !== null,
    publicKey: keys?.publicKey ?? null,
    preferences: await createPushRepository(env.DB).getPreferences(user.id),
  };
}

export async function subscribe(env: Bindings, user: AuthenticatedUser, endpoint: string, p256dh: string, auth: string): Promise<void> {
  if (!vapidKeys(env)) throw serviceUnavailable("Los avisos todavía no están activados en el servidor");
  if (!isAllowedPushEndpoint(endpoint)) throw badRequest("Este navegador usa un servicio de avisos que no conocemos");
  await createPushRepository(env.DB).upsertSubscription(user.id, endpoint, p256dh, auth);
}

export async function unsubscribe(env: Bindings, user: AuthenticatedUser, endpoint: string): Promise<void> {
  await createPushRepository(env.DB).deleteSubscription(user.id, endpoint);
}

export async function setPreferences(env: Bindings, user: AuthenticatedUser, prefs: PushPreferences): Promise<PushPreferences> {
  const repository = createPushRepository(env.DB);
  await repository.setPreferences(user.id, prefs);
  return repository.getPreferences(user.id);
}

/** Aviso de prueba a este dispositivo. Devuelve false si no llegó al servicio de push. */
export async function sendTest(env: Bindings, user: AuthenticatedUser, endpoint: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  const keys = vapidKeys(env);
  if (!keys) throw serviceUnavailable("Los avisos todavía no están activados en el servidor");
  const repository = createPushRepository(env.DB);
  const [subscription] = (await repository.listSubscriptions([user.id])).filter((sub) => sub.endpoint === endpoint);
  if (!subscription) throw badRequest("Este dispositivo no tiene los avisos activados");
  const payload: PushPayload = { title: "Nuestro Lugar 💗", body: "Así se verán los avisos en este dispositivo.", url: "/perfil", tag: "test" };
  const result = await sendPush(subscription, JSON.stringify(payload), keys, { ttl: 300, urgency: "high" }, fetcher);
  if (!result.ok && result.gone) await repository.deleteSubscriptionById(subscription.id);
  return result.ok;
}
