# worker/auth

- `accessJwt.ts`: verifica el JWT `Cf-Access-Jwt-Assertion` con las claves públicas de
  Cloudflare Access (firma RS256, `iss`, `aud`, expiración). La cabecera
  `Cf-Access-Authenticated-User-Email` nunca se usa.
- `allowedEmails.ts`: segunda comprobación del correo contra `ALLOWED_EMAILS`
  (defensa en profundidad si alguien cambia la política de Access por error).
- `../middleware/auth.ts`: `requireUser` (JWT + whitelist + carga/crea el usuario) y
  `requireRelationship` (para rutas de contenido).

Modo local: con `ENVIRONMENT=development`, `DEV_USER_EMAIL` y una petición a `localhost`,
se usa ese correo en lugar del JWT. Las tres condiciones deben cumplirse; en producción
`ENVIRONMENT` es `production` y `.dev.vars` no se despliega.

Fase 12 (app de Android): segunda puerta, solo en el Worker `app-movil` (`AUTH_MODE=mobile`):

- `googleOAuth.ts`: OAuth 2.0 Authorization Code + PKCE con Google y verificación del ID token.
- `mobileTokens.ts`: tokens propios firmados con `MOBILE_TOKEN_SECRET` (acceso 15 min, fotos
  semanal) y utilidades de PKCE.
- `../services/mobileAuthService.ts`: el flujo completo (ver el comentario de arriba del archivo).
- `requireUser` en ese Worker acepta solo `Authorization: Bearer` (o `?mt=` para ver fotos y
  audios) y comprueba en cada petición que la sesión siga abierta y el correo siga en la lista.
  El Worker web (`app`) nunca acepta esos tokens. El resto del Worker no cambia: solo lee `c.var.user`.
