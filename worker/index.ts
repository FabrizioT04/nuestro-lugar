import { Hono } from "hono";
import type { AppEnv } from "./env";
import { requestId } from "./middleware/requestId";
import { securityHeaders } from "./middleware/securityHeaders";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { healthRoutes } from "./routes/health";

// Punto de entrada del Worker. Solo recibe /api/* (ver `run_worker_first` en wrangler.jsonc);
// el resto de rutas las sirve Cloudflare directamente desde los assets de React.
//
// Orden de cada petición (a partir de la Fase 2):
//   requestId → securityHeaders → autenticación → autorización → validación → servicio → repositorio (D1/R2)
const app = new Hono<AppEnv>().basePath("/api");

app.use("*", requestId);
app.use("*", securityHeaders);

app.route("/health", healthRoutes);

app.notFound(notFoundHandler);
app.onError(errorHandler);

export default app satisfies ExportedHandler<Env>;
