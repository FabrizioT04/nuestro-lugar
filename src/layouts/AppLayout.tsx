import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { Heart, WifiOff } from "lucide-react";
import { useMe } from "@/auth/AuthContext";
import { BottomNav } from "@/components/BottomNav";
import { SyncIndicator } from "@/components/sync/SyncIndicator";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { pushSupport, refreshPushSubscription } from "@/pwa/push";

/** Estructura de las pantallas principales: contenido en una columna móvil + navegación inferior. */
export function AppLayout() {
  const me = useMe();
  const online = useOnlineStatus();
  const { pathname } = useLocation();
  const home = pathname === "/";

  // Si este dispositivo tiene los avisos activados, se lo recuerda al Worker una vez por apertura.
  useEffect(() => {
    if (pushSupport() === "supported") void refreshPushSubscription();
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-paper">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:p-4">Ir al contenido</a>
      {!online && (
        <p className="flex items-center justify-center gap-2 bg-lavender-100 px-4 py-2 text-center text-sm text-lavender-500">
          <WifiOff size={16} aria-hidden />
          Sin conexión. Lo que guardes se enviará al volver.
        </p>
      )}
      <SyncIndicator />

      {/* En Inicio la cabecera va encima de la foto grande, en blanco. */}
      <div className="relative flex flex-1 flex-col">
        <header className={`flex items-center justify-between gap-4 px-5 pt-safe pb-2 ${home ? "absolute inset-x-0 top-0 z-10 text-white" : ""}`}>
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold tracking-tight">
            <Heart size={16} strokeWidth={2} className={home ? "text-white" : "text-blush-500"} aria-hidden /> Nuestro Lugar
          </Link>
          <Link
            to="/perfil"
            aria-label="Ir a mi perfil"
            className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold ${home ? "bg-white/25 text-white backdrop-blur" : "bg-blush-50 text-ink"}`}
          >
            {me.user.displayName.charAt(0).toUpperCase()}
          </Link>
        </header>

        <main id="main-content" className={`min-w-0 flex-1 px-5 pb-32 ${home ? "pt-0" : "pt-6"}`}>
          {/* La clave cambia con la ruta: cada pantalla nueva entra con un fundido suave. */}
          <div key={pathname} className="animate-page-in">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
