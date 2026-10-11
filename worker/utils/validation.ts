import type { Context } from "hono";
import type { z } from "zod";
import { badRequest } from "./errors";

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
