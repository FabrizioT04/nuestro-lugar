# Configurar Cloudflare Access con Google

Pasos para publicar Nuestro Lugar de forma que solo puedan entrar los dos correos permitidos.
Los nombres de los menús de Cloudflare y Google cambian a veces; si algo no coincide exactamente,
busca la opción equivalente.

Hay dos barreras independientes:

1. **Cloudflare Access** (antes de llegar a la app): pide iniciar sesión con Google y solo deja
   pasar a los correos de su política.
2. **El Worker** (en cada llamada a `/api`): verifica la firma del token de Access y vuelve a
   comprobar el correo contra `ALLOWED_EMAILS`.

## 1. Crear la base de datos y publicar el Worker

```bash
npx wrangler login
npx wrangler d1 create nuestro-lugar-db
```

Copia el `database_id` que aparece en `wrangler.jsonc` (reemplaza los ceros) y luego:

```bash
npm run db:migrate:remote
npm run deploy
```

Al terminar verás la URL, por ejemplo `https://nuestro-lugar.<tu-subdominio>.workers.dev`.
En este momento la API ya responde 401/500 a cualquiera (aún no hay secretos), así que no se
filtra ningún dato, pero la pantalla vacía es visible hasta completar el paso 4.

## 2. Activar Zero Trust

1. En el panel de Cloudflare abre **Zero Trust**.
2. Elige un nombre de equipo (team name). Tu dominio de equipo será
   `https://<team>.cloudflareaccess.com`. Guárdalo: es `ACCESS_TEAM_DOMAIN`.
3. Elige el plan **Free** (hasta 50 usuarios).

## 3. Añadir Google como proveedor de identidad

En [Google Cloud Console](https://console.cloud.google.com/):

1. Crea un proyecto (p. ej. "Nuestro Lugar").
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo *Externo*, nombre de la app,
   tu correo de soporte. Añade los dos correos como usuarios de prueba.
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: *Aplicación web*.
   - Orígenes autorizados de JavaScript: `https://<team>.cloudflareaccess.com`
   - URI de redireccionamiento autorizado: `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback`
4. Copia el *Client ID* y el *Client secret*.

En Cloudflare **Zero Trust → Settings → Authentication → Login methods → Add new → Google**:
pega el Client ID y el secret, guarda y pulsa **Test** para comprobarlo.

## 4. Proteger la aplicación con Access

**Zero Trust → Access → Applications → Add an application → Self-hosted**:

- Nombre: `Nuestro Lugar`.
- Dominio: el de tu Worker (`nuestro-lugar.<tu-subdominio>.workers.dev`) o tu dominio propio.
- Session duration: la que prefieras (p. ej. 1 mes, para no iniciar sesión a cada rato).
- Identity providers: solo **Google**, y activa *Instant Auth* para saltar la pantalla de elección.
- Policy: acción **Allow**, regla *Include → Emails* con los dos correos.

Guarda y copia el **Application Audience (AUD) Tag** de la aplicación: es `ACCESS_AUD`.

## 5. Guardar los secretos en el Worker

```bash
npx wrangler secret put ALLOWED_EMAILS       # tu-correo@gmail.com,correo-pareja@gmail.com
npx wrangler secret put ACCESS_TEAM_DOMAIN   # https://<team>.cloudflareaccess.com
npx wrangler secret put ACCESS_AUD           # el AUD tag del paso 4
```

Los secretos se aplican al momento, sin volver a desplegar. Nunca van en el repositorio ni en
el frontend.

## 6. Probar

| Prueba | Resultado esperado |
| --- | --- |
| Abrir la URL en una ventana de incógnito | Login de Google (vía Access) |
| Entrar con tu correo | Pantalla "Antes de empezar" (solo la primera vez) |
| Entrar con el correo de tu pareja | Directo al inicio, ya configurado |
| Entrar con otro correo de Google | Access lo bloquea con su propia página |
| `curl https://<tu-url>/api/me` sin sesión | Redirección de Access (o 401 del Worker) |
| Perfil → Cerrar sesión | Vuelve al login de Access |

Si aparece "El servidor no está configurado correctamente", falta alguno de los tres secretos.
Los detalles están en **Workers → nuestro-lugar → Logs**.
