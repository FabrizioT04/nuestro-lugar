import { cors } from "hono/cors";

// Solo en el Worker móvil: la app de Android carga React desde https://localhost (dentro del APK)
// y llama a este dominio. No hay cookies; la sesión va en la cabecera Authorization.
// iOS (si algún día se agrega) usa capacitor://localhost.
export const mobileCors = cors({
  origin: ["https://localhost", "capacitor://localhost"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["authorization", "content-type", "x-client-action-id", "accept"],
  maxAge: 86400,
});
