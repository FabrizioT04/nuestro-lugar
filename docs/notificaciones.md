# Notificaciones push (fase 13)

Avisos en el teléfono aunque la app esté cerrada. Usa Web Push estándar (claves VAPID): no hace falta
Firebase, ni una cuenta nueva, ni pagar nada. El Worker cifra cada aviso para el navegador que lo va a
recibir; Chrome lo entrega a través del servicio de push de Google, pero sin ver su contenido.

## Dónde funciona

| Dispositivo | ¿Funciona? |
| --- | --- |
| Android con Chrome o Edge (mejor con la app instalada) | Sí |
| iPhone/iPad (iOS 16.4 o más) | Sí, pero solo abriendo la app desde la pantalla de inicio |
| Computadora con Chrome, Edge, Firefox o Safari | Sí |
| APK de Android (Capacitor) | No: necesitaría Firebase. Usa la web instalada para los avisos |

## 1. Base de datos

```powershell
git pull
npm install
npm run db:migrate:remote
```

Debe aplicar `0008_push_notifications.sql`.

## 2. Claves VAPID (una sola vez)

```powershell
npm run push:claves
npx wrangler secret bulk .push-claves.json
npx wrangler secret bulk .push-claves.json -c wrangler.movil.jsonc
del .push-claves.json
```

- El primer comando crea `.push-claves.json` con las dos claves (git lo ignora).
- Los dos siguientes las suben a los dos Workers (`app` y `app-movil`): así también avisa cuando la otra
  persona guarda algo desde el APK.
- Después se borra el archivo. Las claves quedan solo en Cloudflare.
- Si algún día cambias las claves, cada teléfono tiene que volver a tocar "Activar avisos".

## 3. Publicar

```powershell
npm run deploy
```

Esto también crea el Cron Trigger (cada 15 minutos) del Worker `app`. Se puede ver en
Workers & Pages → app → Settings → Triggers.

## 4. Activar en cada teléfono

1. Abre Nuestro Lugar (la app instalada).
2. **Perfil → Avisos en este teléfono → Activar avisos** y acepta el permiso.
3. Toca **Probar**: debería llegar un aviso en unos segundos.

Cada persona lo hace en su teléfono. Los interruptores (cartas, recuerdos, cápsulas, fechas, planes)
valen para todos los dispositivos de esa persona.

## Qué avisos hay

| Aviso | Cuándo | A quién |
| --- | --- | --- |
| Carta nueva | Al guardarla (las sorpresas no se anuncian) | A quien la recibe |
| Carta que ya se puede abrir | Al llegar su fecha (programadas y sorpresas) | A quien la recibe |
| Recuerdo nuevo | Al guardarlo | A la otra persona |
| Cápsula nueva | Al guardarla | A la otra persona |
| Cápsula que ya se puede abrir | Al llegar su fecha | A quien va dirigida (o a los dos) |
| Aniversario y mesiversario | Ese día (y el aniversario también un día antes) | A los dos |
| Fechas importantes | Ese día y un día antes | A los dos |
| Planes | El día del plan | A los dos |

Los avisos de fechas y planes solo salen entre las 9:00 y las 21:59 de la zona horaria de la pareja.
Cada aviso se manda una sola vez. Los avisos nunca muestran el texto de una carta ni de una cápsula.

## Costo

Nada. El cron corre 96 veces al día y cada vez hace unas pocas consultas a D1; todo está muy por debajo
del plan gratuito de Cloudflare. Los servicios de push de Google, Mozilla y Apple son gratuitos.

## Si algo falla

| Síntoma | Causa probable |
| --- | --- |
| "Todavía no están activados en el servidor" | Faltan los secretos del paso 2 en `app` |
| "El navegador tiene los avisos bloqueados" | Se tocó "Bloquear". Candado de la barra de direcciones → Permisos → Notificaciones → Permitir |
| En iPhone no aparece el botón | Hay que abrir la app desde la pantalla de inicio, no desde Safari |
| "Probar" dice que no lo aceptó | Toca "Desactivar aquí" y luego "Activar avisos" otra vez |
| Llegan los de prueba pero no los programados | Revisa el cron en Workers & Pages → app → Settings → Triggers, y los logs |
| No llegan con el teléfono en ahorro de batería | Android puede retrasarlos; quita la restricción de batería para Chrome |
