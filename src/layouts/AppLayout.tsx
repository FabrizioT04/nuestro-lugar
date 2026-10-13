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

  // Si este dispositivo tiene los avisos activados, se lo recuerda al Worker una vez por apertura.
  useEffect(() => {
    if (pushSupport() === "supported") void refreshPushSubscription();
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-cream">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:p-4">Ir al contenido</a>
      {!online && (
        <p className="flex items-center justify-center gap-2 bg-lavender-100 px-4 py-2 text-center text-sm text-lavender-500">
          <WifiOff size={16} aria-hidden />
          Sin conexión. Lo que guardes se enviará al volver.
        </p>
      )}
      <SyncIndicator />

      <header className="flex items-center justify-between gap-4 px-5 pt-safe pb-2">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold">
          <Heart size={16} strokeWidth={1.6} className="text-blush-500" aria-hidden /> Nuestro Lugar
        </Link>
        <Link to="/perfil" aria-label="Ir a mi perfil" className="flex h-11 w-11 items-center justify-center rounded-full bg-blush-100 text-xs font-semibold text-blush-700">
          {me.user.displayName.charAt(0).toUpperCase()}
        </Link>
      </header>

      <main id="main-content" className="min-w-0 flex-1 px-5 pt-6 pb-32">
        {/* La clave cambia con la ruta: cada pantalla nueva entra con un fundido suave. */}
        <div key={pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
