# src/platform

Capacidades del dispositivo (Fase 12, Capacitor). Cada una tiene la versión web y la de la app de
Android detrás de la misma función, así nada básico depende de APIs exclusivas del navegador:

- `native.ts` → `isNativeApp` y la dirección del Worker de la app (`app-movil`).
- `geolocation.ts` → `navigator.geolocation` en la web / `@capacitor/geolocation` en la app.
- `nativeApp.ts` → arranque de la app: sesión guardada, deep links (`nuestrolugar://…`, p. ej. para
  abrir una pantalla desde la futura "Nuestra Granjita") y el botón "atrás" de Android.
- Cámara: `<input type="file">` funciona igual en la web y en la app (abre la cámara del teléfono),
  así que no hace falta un plugin.
- Almacenamiento: IndexedDB funciona igual en la app. Los tokens de la sesión van al Keystore de
  Android (`src/auth/mobileSession.ts`).
- Notificaciones push: pendientes. En Android requieren Firebase Cloud Messaging, que el proyecto no usa.
