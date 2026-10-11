import type { Context } from "hono";
import type { z } from "zod";
import { badRequest, notFound } from "./errors";

/** Lee el cuerpo JSON y lo valida con un esquema Zod. Responde 400 con el primer error. */
export async function parseJsonBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const body: unknown = await c.req.json().catch(() => {
    throw badRequest("El cuerpo debe ser JSON válido");
  });
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join(".");
    throw badRequest(field ? `${field}: ${issue?.message}` : (issue?.message ?? "Datos inválidos"));
  }
  return result.data;
}

/** Valida los parámetros de la URL (?q=...) con un esquema Zod. */
export function parseQuery<T extends z.ZodType>(c: Context, schema: T): z.infer<T> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    const issue = result.error.issues[0];
    throw badRequest(`${issue?.path.join(".") ?? "query"}: ${issue?.message ?? "inválido"}`);
  }
  return result.data;
}

/** Valida un id de la ruta; si no es un UUID, responde 404 como si no existiera. */
export function parseIdParam(c: Context, name = "id"): string {
  const value = c.req.param(name) ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw notFound();
  return value.toLowerCase();
}
