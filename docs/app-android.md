# App de Android (fase 12)

Pasos para publicar el Worker de la app y generar el APK. Todo es gratis: el segundo Worker entra
en el mismo plan gratuito de Cloudflare y Android Studio es gratuito.

## Cómo funciona (en corto)

- La web sigue igual: `https://app.nuestro-lugar.workers.dev`, detrás de Cloudflare Access.
- La app usa otro Worker, `https://app-movil.nuestro-lugar.workers.dev`. Tiene el mismo código y la
  misma base de datos, pero sin Access delante, porque dentro de la app no existen las cookies de Access.
  Ese Worker solo acepta los tokens de la app y rechaza todo lo demás con 401.
- Para entrar, la app abre Google en el navegador del teléfono. Google le confirma el correo al Worker,
  el Worker lo compara con `ALLOWED_EMAILS` y le devuelve a la app sus tokens por un deep link
  (`nuestrolugar://auth`). La contraseña de Google nunca pasa por la app ni por el Worker.
- La app no tiene secretos: ni Service Tokens, ni el secreto de Google, ni claves de API.

## 1. Base de datos

```powershell
git pull
npm install
npm run db:migrate:remote
```

Debe aplicar `0007_mobile_sessions.sql` (sesiones de la app; solo guarda hashes).

## 2. Cliente OAuth en Google Cloud

En el mismo proyecto de Google Cloud que usaste para Cloudflare Access:

1. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
2. Tipo de aplicación: **Aplicación web**. Nombre: `Nuestro Lugar app`.
3. **URIs de redireccionamiento autorizados** → agregar exactamente:
   `https://app-movil.nuestro-lugar.workers.dev/api/auth/mobile/callback`
4. Crear. Copia el **ID de cliente** y el **Secreto del cliente** (los usas en el paso 4).
5. En **Pantalla de consentimiento de OAuth**: si dice "En prueba", revisa que los dos correos estén en
   **Usuarios de prueba**. Solo se piden `openid` y `email`, así que no hace falta verificar la app.

## 3. Publicar los dos Workers

```powershell
npm run deploy
```

Ahora publica `app` (web) y también `app-movil`. La primera vez Cloudflare crea `app-movil`.
Hasta completar el paso 4 responde "El servidor no está configurado correctamente", sin mostrar datos.

## 4. Secretos del Worker de la app

Se configuran aparte de los de la web (cada Worker tiene los suyos). Primero genera una clave aleatoria
para firmar los tokens:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Luego, uno por uno (cada comando pide el valor):

```powershell
npx wrangler secret put ALLOWED_EMAILS -c wrangler.movil.jsonc
npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID -c wrangler.movil.jsonc
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET -c wrangler.movil.jsonc
npx wrangler secret put MOBILE_TOKEN_SECRET -c wrangler.movil.jsonc
```

- `ALLOWED_EMAILS`: los mismos dos correos que en la web, separados por coma.
- `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET`: los del paso 2.
- `MOBILE_TOKEN_SECRET`: la clave que generaste. Si algún día la cambias, se cierran las sesiones de la app.
- Cuando actives Google Places: `npx wrangler secret put GOOGLE_PLACES_API_KEY -c wrangler.movil.jsonc`.
- Avisos push (fase 13): las claves VAPID también van aquí; ver [notificaciones.md](./notificaciones.md).

Comprobación rápida en el navegador:
- `https://app-movil.nuestro-lugar.workers.dev/api/health` → `{"status":"ok",...}`
- `https://app-movil.nuestro-lugar.workers.dev/api/me` → error 401 (correcto: sin token no entra nadie).

**No actives Cloudflare Access en `app-movil`.** Si lo activas, la app no podrá conectarse.

## 5. Generar el APK

1. Instala **Android Studio** (gratis, trae su propio Java): https://developer.android.com/studio
   La primera vez deja que descargue el SDK que propone.
2. En la carpeta del proyecto:
   ```powershell
   npm run android
   npm run android:abrir
   ```
   Espera a que Android Studio termine "Gradle sync" (abajo a la derecha).
3. Menú **Build → Generate App Bundles or APKs → Generate APKs** (en versiones antiguas:
   **Build → Build Bundle(s) / APK(s) → Build APK(s)**).
4. Al terminar, "locate" abre la carpeta: `android\app\build\outputs\apk\debug\app-debug.apk`.
5. Pasa ese archivo a los dos teléfonos (WhatsApp, Drive o cable) y ábrelo. Android pedirá permitir
   "instalar apps desconocidas" para esa app; acéptalo solo para instalar.

Alternativa con cable: activa "Depuración USB" en el teléfono, conéctalo y pulsa ▶ (Run) en Android Studio.

## Actualizar la app

- Cambios del Worker (API, base de datos): `npm run deploy` y listo, la app los usa al instante.
- Cambios de pantallas (React): `npm run android`, genera el APK otra vez e instálalo encima. No se
  pierde la sesión ni los datos.

## Si algo falla

| Síntoma | Causa probable |
| --- | --- |
| Google dice `redirect_uri_mismatch` | La URI del paso 2 no es exactamente la del callback (revisa `https`, sin `/` al final) |
| Google dice "Acceso bloqueado" o "app no verificada" | El correo no está en "Usuarios de prueba" (paso 2.5) |
| La app dice "Esa cuenta de Google no tiene acceso" | El correo no está en `ALLOWED_EMAILS` de `app-movil` |
| Tras elegir la cuenta queda una página "Volver a la app" | Toca el botón; algunos navegadores no saltan solos a la app |
| La app dice "No se pudo iniciar sesión" | Revisa los secretos del paso 4 y los logs: Workers & Pages → app-movil → Logs |
