import { Hono } from "hono";
import type { AppEnv } from "./env";
import { requestId } from "./middleware/requestId";
import { securityHeaders } from "./middleware/securityHeaders";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { healthRoutes } from "./routes/health";
import { homeRoutes } from "./routes/home";
import { meRoutes } from "./routes/me";
import { relationshipRoutes } from "./routes/relationship";

// Punto de entrada del Worker. Solo recibe /api/* (ver `run_worker_first` en wrangler.jsonc);
// el resto de rutas las sirve Cloudflare directamente desde los assets de React.
//
// Orden de cada petición protegida:
//   requestId → securityHeaders → requireUser (JWT de Access + whitelist) → autorización
//   → validación (Zod) → servicio → repositorio (D1/R2)
//
// /api/health es la única ruta sin requireUser (igualmente queda detrás de Access en producción).
const app = new Hono<AppEnv>().basePath("/api");

app.use("*", requestId);
app.use("*", securityHeaders);

app.route("/health", healthRoutes);
app.route("/me", meRoutes);
app.route("/home", homeRoutes);
app.route("/relationship", relationshipRoutes);

app.notFound(notFoundHandler);
app.onError(errorHandler);

export default app satisfies ExportedHandler<Env>;
