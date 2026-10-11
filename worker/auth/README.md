# worker/auth

Fase 2. Aquí vivirá:

- `accessJwt.ts`: verificación del JWT `Cf-Access-Jwt-Assertion` contra las claves públicas
  de Cloudflare Access (firma, `aud`, `iss`, expiración). Nunca se confía solo en la cabecera
  `Cf-Access-Authenticated-User-Email`.
- `allowedUsers.ts`: segunda comprobación del email contra `ALLOWED_EMAILS` (defensa en profundidad,
  por si alguien cambia la política de Access por error).
- Middleware `requireUser` que carga el usuario y su relación y los deja en `c.var`.
- Más adelante (Fase 12): tokens para la app móvil vía OAuth Authorization Code + PKCE.
