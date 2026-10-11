// Variables disponibles en el contexto de Hono para cada petición.
// Fase 2 añadirá aquí el usuario autenticado y su relación.
export interface AppVariables {
  requestId: string;
}

export interface AppEnv {
  Bindings: Env;
  Variables: AppVariables;
}
