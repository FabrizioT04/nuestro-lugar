import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";
import { createSyncActionRepository, type StoredSyncAction } from "../repositories/syncActionRepository";
import { badRequest, conflict } from "../utils/errors";

export const CLIENT_ACTION_HEADER = "x-client-action-id";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CONCURRENT_WAIT_ATTEMPTS = 4;
const CONCURRENT_WAIT_MS = 500;

interface StoredResponse {
  status: number;
  body: unknown;
}

/**
 * Idempotencia para la cola offline (patrón Outbox). Cada acción que manda la app lleva un
 * `X-Client-Action-Id` único. La primera vez se ejecuta normal y, si sale bien, se guarda la
 * respuesta en `sync_actions`. Si la misma acción vuelve a llegar (un reintento porque se cortó
 * la conexión antes de recibir la respuesta), se devuelve la respuesta guardada sin repetir nada.
 * Sin la cabecera, la petición sigue igual que siempre. Usar después de requireUser.
 */
export const idempotent = createMiddleware<AppEnv>(async (c, next) => {
  const clientActionId = c.req.header(CLIENT_ACTION_HEADER);
  if (!clientActionId || !WRITE_METHODS.has(c.req.method)) return next();
  if (!UUID.test(clientActionId)) throw badRequest("X-Client-Action-Id debe ser un UUID");

  const id = clientActionId.toLowerCase();
  const user = c.get("user");
  const repo = createSyncActionRepository(c.env.DB);

  const replay = (previous: StoredSyncAction) => {
    if (previous.user_id !== user.id) throw conflict("Esta acción ya se usó");
    const stored = JSON.parse(previous.response_json ?? "null") as StoredResponse | null;
    const headers = { "x-replayed": "1" };
    if (!stored || stored.body === null) return new Response(null, { status: stored?.status ?? 204, headers });
    return Response.json(stored.body, { status: stored.status, headers });
  };

  const previous = await repo.find(id);
  if (previous) return replay(previous);

  await next();

  // Solo se recuerdan las acciones que se aplicaron. Un error (validación, permisos, servidor)
  // puede reintentarse más tarde y volver a evaluarse.
  if (c.res.ok) {
    const text = await c.res.clone().text();
    const body: unknown = text ? JSON.parse(text) : null;
    const path = new URL(c.req.url).pathname;
    await repo.record({
      clientActionId: id,
      userId: user.id,
      actionType: `${c.req.method} ${path}`,
      entityType: path.split("/")[2] ?? "unknown",
      responseJson: JSON.stringify({ status: c.res.status, body } satisfies StoredResponse),
    });
    return;
  }

  // Dos envíos de la misma acción a la vez (la app reintentó mientras el primero seguía en curso):
  // el segundo choca con el id que acaba de crear el primero (409). Se espera un momento a que el
  // primero termine y se devuelve su respuesta, en vez de un error que la app mostraría como ⚠.
  if (c.res.status === 409) {
    for (let attempt = 0; attempt < CONCURRENT_WAIT_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, CONCURRENT_WAIT_MS));
      const winner = await repo.find(id);
      if (winner) {
        c.res = undefined; // descarta el 409
        c.res = replay(winner);
        return;
      }
    }
  }
});
