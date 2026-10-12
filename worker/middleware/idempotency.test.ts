import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppEnv } from "../env";
import { conflict } from "../utils/errors";
import { errorHandler } from "./errorHandler";
import { idempotent } from "./idempotency";

/** D1 mínima en memoria: solo lo que usa syncActionRepository. */
function fakeDb() {
  const rows = new Map<string, { user_id: string; response_json: string }>();
  const statement = (sql: string, params: unknown[] = []) => ({
    bind: (...values: unknown[]) => statement(sql, values),
    first: async () => {
      const row = rows.get(params[0] as string);
      return row ? { ...row } : null;
    },
    run: async () => {
      if (sql.includes("INSERT OR IGNORE") && !rows.has(params[0] as string)) {
        rows.set(params[0] as string, { user_id: params[1] as string, response_json: params[4] as string });
      }
      return { success: true };
    },
  });
  const db = {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: { run: () => Promise<unknown> }[]) => Promise.all(statements.map((s) => s.run())),
  };
  return { db: db as unknown as D1Database, rows };
}

function makeApp(handler: () => Response | Promise<Response>, userId = "u1") {
  const { db, rows } = fakeDb();
  let calls = 0;
  const app = new Hono<AppEnv>();
  app.onError(errorHandler);
  app.use(async (c, next) => {
    c.set("requestId", "test");
    c.set("user", { id: c.req.header("x-test-user") ?? userId } as AppEnv["Variables"]["user"]);
    await next();
  });
  app.use(idempotent);
  app.post("/api/memories", async () => {
    calls++;
    return handler();
  });
  app.delete("/api/memories/x", async () => {
    calls++;
    return new Response(null, { status: 204 });
  });
  const env = { DB: db } as unknown as AppEnv["Bindings"];
  const send = (actionId?: string, init: RequestInit = {}) =>
    app.request(
      "/api/memories",
      { method: "POST", ...init, headers: { ...(actionId ? { "x-client-action-id": actionId } : {}), ...(init.headers as object) } },
      env,
    );
  return { app, env, send, rows, calls: () => calls };
}

const ID = "6f1c2b9e-3a4d-4c5e-8f70-112233445566";

describe("idempotencia con X-Client-Action-Id", () => {
  it("sin cabecera se ejecuta siempre", async () => {
    const t = makeApp(() => Response.json({ id: "m1" }, { status: 201 }));
    await t.send();
    await t.send();
    expect(t.calls()).toBe(2);
    expect(t.rows.size).toBe(0);
  });

  it("la misma acción repetida se aplica una vez y devuelve la misma respuesta", async () => {
    const t = makeApp(() => Response.json({ id: "m1", title: "Playa" }, { status: 201 }));
    const first = await t.send(ID);
    const second = await t.send(ID.toUpperCase());
    expect(t.calls()).toBe(1);
    expect(second.status).toBe(201);
    expect(second.headers.get("x-replayed")).toBe("1");
    expect(await second.json()).toEqual(await first.json());
  });

  it("repite también respuestas sin cuerpo (204)", async () => {
    const t = makeApp(() => new Response(null));
    const del = () => t.app.request("/api/memories/x", { method: "DELETE", headers: { "x-client-action-id": ID } }, t.env);
    await del();
    const again = await del();
    expect(again.status).toBe(204);
    expect(t.calls()).toBe(1);
  });

  it("los errores no se guardan: se puede reintentar", async () => {
    let fail = true;
    const t = makeApp(() => (fail ? Response.json({ error: "x" }, { status: 400 }) : Response.json({ ok: true })));
    expect((await t.send(ID)).status).toBe(400);
    fail = false;
    expect((await t.send(ID)).status).toBe(200);
    expect(t.calls()).toBe(2);
  });

  it("rechaza ids que no son UUID", async () => {
    const t = makeApp(() => Response.json({}));
    expect((await t.send("123")).status).toBe(400);
    expect(t.calls()).toBe(0);
  });

  it("otra persona no puede reutilizar el id de una acción", async () => {
    const t = makeApp(() => Response.json({ id: "m1" }, { status: 201 }));
    await t.send(ID);
    const other = await t.send(ID, { headers: { "x-test-user": "u2" } });
    expect(other.status).toBe(409);
    expect(t.calls()).toBe(1);
  });

  it("dos envíos a la vez: el que choca (409) devuelve la respuesta del primero", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let n = 0;
    const t = makeApp(async () => {
      n++;
      if (n === 1) {
        await gate;
        return Response.json({ id: "m1" }, { status: 201 });
      }
      throw conflict("Este recuerdo ya existe");
    });
    const first = t.send(ID);
    await new Promise((r) => setTimeout(r, 10));
    const second = t.send(ID);
    setTimeout(release, 50);
    const [a, b] = await Promise.all([first, second]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(await b.json()).toEqual({ id: "m1" });
  });
});
