import { Outlet } from "react-router";
import { WifiOff } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { SyncIndicator } from "@/components/sync/SyncIndicator";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/** Estructura de las pantallas principales: contenido en una columna móvil + navegación inferior. */
export function AppLayout() {
  const online = useOnlineStatus();

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      {!online && (
        <p className="flex items-center justify-center gap-2 bg-lavender-100 px-4 py-2 text-center text-sm text-lavender-500">
          <WifiOff size={16} aria-hidden />
          Sin conexión. Lo que guardes se enviará al volver.
        </p>
      )}
      <SyncIndicator />

      <main className="flex-1 px-5 pt-safe pb-32">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
