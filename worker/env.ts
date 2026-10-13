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
  /**
   * Qué puerta de entrada usa este Worker:
   *   - "access" (o vacío): la web/PWA, detrás de Cloudflare Access (worker `app`).
   *   - "mobile": la app de Android (worker `app-movil`, ver wrangler.movil.jsonc), con tokens propios.
   * Cada Worker acepta solo su propia puerta.
   */
  AUTH_MODE?: string;
  /** ID del cliente OAuth "Aplicación web" de Google. No es secreto, pero va junto al secreto. */
  GOOGLE_OAUTH_CLIENT_ID?: string;
  /** Secreto del cliente OAuth. Solo en el Worker móvil (`wrangler secret put … -c wrangler.movil.jsonc`). */
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  /** Clave para firmar los tokens de la app (mínimo 32 caracteres aleatorios). */
  MOBILE_TOKEN_SECRET?: string;
  /** Límite de intentos de inicio de sesión por IP (solo en el Worker móvil). */
  AUTH_LIMITER?: RateLimit;
  /**
   * Claves VAPID de las notificaciones push (fase 13), en base64url. Generar con `npm run push:claves`.
   * La pública se entrega al navegador; la privada nunca sale del Worker. Sin ellas no se envían avisos.
   */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  /** Contacto para los servicios de push ("mailto:..." o https). Opcional. */
  VAPID_SUBJECT?: string;
  /** Solo desarrollo local: correo con el que se simula la sesión. */
  DEV_USER_EMAIL?: string;
}

export type Bindings = Env & AppSecrets;

// Variables disponibles en el contexto de Hono para cada petición.
export interface AppVariables {
  requestId: string;
  user: AuthenticatedUser;
  /** Solo en la app móvil: la sesión del dispositivo (para cerrarla). */
  mobileSessionId?: string;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: AppVariables;
}
