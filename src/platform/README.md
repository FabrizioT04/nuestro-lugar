# src/platform

Abstracciones sobre capacidades del dispositivo (Fase 12, Capacitor).

Cada capacidad tendrá una interfaz y dos implementaciones: web y nativa. El resto de la app
solo importa la interfaz, así nada básico depende de APIs exclusivas del navegador:

- `geolocation.ts` → `navigator.geolocation` / `@capacitor/geolocation`
- `camera.ts` → `<input type="file" capture>` / `@capacitor/camera`
- `storage.ts` → IndexedDB / `@capacitor/preferences`
- `notifications.ts` → Web Push / `@capacitor/push-notifications`
- `deepLinks.ts` → URLs / `@capacitor/app` (`appUrlOpen`), p. ej. abrir "Nuestra Granjita"
