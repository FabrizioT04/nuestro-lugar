import { Navigate, Outlet, useLocation } from "react-router";
import { AccessDeniedPage } from "@/pages/AccessDeniedPage";
import { AuthStatusPage } from "@/pages/AuthStatusPage";
import { useAuth } from "./AuthContext";

export const SETUP_PATH = "/configuracion";

/**
 * Protege todas las rutas hijas. La seguridad real está en el Worker (cada /api comprueba
 * la sesión); esto solo decide qué pantalla mostrar.
 */
export function RequireAuth() {
  const { state, refresh } = useAuth();
  const location = useLocation();

  switch (state.status) {
    case "loading":
      return <AuthStatusPage title="Abriendo nuestro lugar…" />;
    case "denied":
      return <AccessDeniedPage message={state.message} />;
    case "signed-out":
      return (
        <AuthStatusPage
          title="Tu sesión terminó"
          action={{ label: "Volver a entrar", onClick: () => window.location.reload() }}
        />
      );
    case "error":
      return (
        <AuthStatusPage
          title="No pudimos conectar"
          description={state.message}
          action={{ label: "Reintentar", onClick: () => void refresh() }}
        />
      );
    case "authenticated": {
      const needsSetup = state.me.relationship === null;
      const onSetup = location.pathname === SETUP_PATH;
      if (needsSetup && !onSetup) return <Navigate to={SETUP_PATH} replace />;
      if (!needsSetup && onSetup) return <Navigate to="/" replace />;
      return <Outlet />;
    }
  }
}
