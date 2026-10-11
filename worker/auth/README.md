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

Fase 12 (app móvil): se añadirá una segunda vía de entrada con tokens propios emitidos tras
OAuth Authorization Code + PKCE con Google. `requireUser` aceptará cualquiera de las dos y el
resto del Worker no cambia, porque solo lee `c.var.user`.
