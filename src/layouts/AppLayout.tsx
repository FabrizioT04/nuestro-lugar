import { useEffect, useRef, type TouchEvent } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { Heart, WifiOff } from "lucide-react";
import { useMe } from "@/auth/AuthContext";
import { BottomNav } from "@/components/BottomNav";
import { SyncIndicator } from "@/components/sync/SyncIndicator";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { HAPTICS, isTappable, vibrate } from "@/fx/haptics";
import { pushSupport, refreshPushSubscription } from "@/pwa/push";
import { slideDirection, startsInScrollable, swipeTarget } from "./pageTransition";

/** Estructura de las pantallas principales: contenido en una columna móvil + navegación inferior. */
export function AppLayout() {
  const me = useMe();
  const online = useOnlineStatus();
  const { pathname } = useLocation();
  const home = pathname === "/";
  const navigate = useNavigate();

  // La pantalla nueva entra deslizándose desde el lado al que vas.
  // Se calcula solo al cambiar de ruta, para que otro render no repita la animación.
  const shown = useRef<{ path: string | null; direction: ReturnType<typeof slideDirection> }>({ path: null, direction: "none" });
  if (shown.current.path !== pathname) shown.current = { path: pathname, direction: slideDirection(shown.current.path, pathname) };
  const direction = shown.current.direction;

  // Deslizar el dedo a los lados cambia de pestaña, como en Instagram.
  const touch = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(event: TouchEvent) {
    const point = event.touches[0];
    touch.current = point && event.touches.length === 1 && !startsInScrollable(event.target) ? { x: point.clientX, y: point.clientY } : null;
  }
  function onTouchEnd(event: TouchEvent) {
    const start = touch.current;
    const point = event.changedTouches[0];
    touch.current = null;
    if (!start || !point) return;
    const target = swipeTarget(pathname, point.clientX - start.x, point.clientY - start.y);
    if (target) void navigate(target);
  }

  // Vibración suave al tocar botones y enlaces (solo en teléfonos que la permiten).
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isTappable(event.target)) vibrate(HAPTICS.tap);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

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

        <main id="main-content" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className={`min-w-0 flex-1 overflow-x-clip px-5 pb-32 ${home ? "pt-0" : "pt-6"}`}>
          {/* La clave cambia con la ruta: cada pantalla nueva entra deslizándose o con un fundido. */}
          <div key={pathname} className={direction === "right" ? "animate-slide-from-right" : direction === "left" ? "animate-slide-from-left" : "animate-page-in"}>
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
