import type { CapacitorConfig } from "@capacitor/cli";

// App de Android (fase 12). El APK lleva dentro la misma app de React que la web (dist/client):
// la app abre al instante y funciona sin conexión con lo guardado. Habla con el Worker `app-movil`
// (ver src/platform/native.ts). No lleva secretos ni Service Tokens: solo los tokens de su sesión.
const config: CapacitorConfig = {
  appId: "com.nuestrolugar.app",
  appName: "Nuestro Lugar",
  webDir: "dist/client",
  android: {
    // La app no carga contenido http.
    allowMixedContent: false,
  },
};

export default config;
