import type { AuthenticatedUser } from "./auth/types";

// Secretos y variables que no están en wrangler.jsonc (se configuran con `wrangler secret put`
// o en .dev.vars). Todos opcionales en tipos: el código debe fallar cerrado si faltan.
export interface AppSecrets {
  /** Correos permitidos separados por coma. Segunda barrera además de la política de Access. */
  ALLOWED_EMAILS?: string;
  /** p. ej. https://mi-equipo.cloudflareaccess.com */
  ACCESS_TEAM_DOMAIN?: string;
  /** Audience (AUD) tag de la aplicación de Access. */
  ACCESS_AUD?: string;
  /** Clave de Google Places API (New), restringida a esa API y con cuotas diarias. Sin ella, Descubrir avisa que no está activado. */
  GOOGLE_PLACES_API_KEY?: string;
  /** Solo desarrollo local: correo con el que se simula la sesión. */
  DEV_USER_EMAIL?: string;
}

export type Bindings = Env & AppSecrets;

// Variables disponibles en el contexto de Hono para cada petición.
export interface AppVariables {
  requestId: string;
  user: AuthenticatedUser;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: AppVariables;
}
