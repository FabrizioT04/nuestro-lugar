import { Hono } from "hono";
import type { AppEnv } from "./env";
import { requestId } from "./middleware/requestId";
import { securityHeaders } from "./middleware/securityHeaders";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { isMobileWorker } from "./middleware/auth";
import { mobileCors } from "./middleware/cors";
import { capsuleRoutes } from "./routes/capsules";
import { healthRoutes } from "./routes/health";
import { homeRoutes } from "./routes/home";
import { letterRoutes } from "./routes/letters";
import { meRoutes } from "./routes/me";
import { mediaRoutes } from "./routes/media";
import { drawingRoutes } from "./routes/drawings";
import { plantRoutes } from "./routes/plant";
import { memoryRoutes } from "./routes/memories";
import { mobileAuthRoutes } from "./routes/mobileAuth";
import { placeRoutes } from "./routes/places";
import { planRoutes } from "./routes/plans";
import { pushRoutes } from "./routes/push";
import { importantDateRoutes, usRoutes } from "./routes/us";
import { relationshipRoutes } from "./routes/relationship";
import { runReminders } from "./services/reminderService";
import type { Bindings } from "./env";

// Punto de entrada del Worker. Solo recibe /api/* (ver `run_worker_first` en wrangler.jsonc);
// el resto de rutas las sirve Cloudflare directamente desde los assets de React.
//
// Orden de cada petición protegida:
//   requestId → securityHeaders → requireUser (JWT de Access + whitelist) → autorización
//   → validación (Zod) → servicio → repositorio (D1/R2)
//
// /api/health es la única ruta sin requireUser (igualmente queda detrás de Access en producción).
//
// Este mismo código se publica dos veces (fase 12):
//   - `app` (wrangler.jsonc): web/PWA detrás de Cloudflare Access.
//   - `app-movil` (wrangler.movil.jsonc, AUTH_MODE=mobile): la app de Android. Sin Access delante,
//     así que solo acepta los tokens propios de la app y agrega CORS y /api/auth/mobile.
export const app = new Hono<AppEnv>().basePath("/api");

app.use("*", requestId);
app.use("*", (c, next) => (isMobileWorker(c.env) ? mobileCors(c, next) : next()));
app.use("*", securityHeaders);
app.use("/auth/mobile/*", async (c, next) => {
  if (!isMobileWorker(c.env)) return notFoundHandler(c);
  await next();
});
app.route("/auth/mobile", mobileAuthRoutes);

app.route("/health", healthRoutes);
app.route("/me", meRoutes);
app.route("/home", homeRoutes);
app.route("/memories", memoryRoutes);
app.route("/letters", letterRoutes);
app.route("/plans", planRoutes);
app.route("/places", placeRoutes);
app.route("/capsules", capsuleRoutes);
app.route("/us", usRoutes);
app.route("/important-dates", importantDateRoutes);
app.route("/media", mediaRoutes);
app.route("/drawings", drawingRoutes);
app.route("/plant", plantRoutes);
app.route("/relationship", relationshipRoutes);
app.route("/push", pushRoutes);

app.notFound(notFoundHandler);
app.onError(errorHandler);

// Avisos programados (fase 13): el Cron Trigger de wrangler.jsonc llama aquí cada 15 minutos.
// Solo el Worker `app` tiene el cron; `app-movil` comparte la base de datos y no lo necesita.
async function scheduled(_controller: ScheduledController, env: Bindings, ctx: ExecutionContext): Promise<void> {
  ctx.waitUntil(runReminders(env).then((sent) => (sent > 0 ? console.log(`push: ${sent} avisos programados enviados`) : undefined)));
}

export default { fetch: app.fetch, scheduled } satisfies ExportedHandler<Bindings>;
