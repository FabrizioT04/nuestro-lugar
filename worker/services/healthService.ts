import type { DatabaseHealthResponse, HealthResponse } from "@shared/api";
import { createSystemRepository } from "../repositories/systemRepository";

// Servicio: lógica de aplicación. No conoce HTTP (eso es de routes/) ni SQL (eso es de repositories/).
export function getHealth(env: Env): HealthResponse {
  return { status: "ok", environment: env.ENVIRONMENT, time: new Date().toISOString() };
}

export async function getDatabaseHealth(env: Env): Promise<DatabaseHealthResponse> {
  const started = Date.now();
  const tables = await createSystemRepository(env.DB).countTables();
  return { status: "ok", tables, latencyMs: Date.now() - started };
}
