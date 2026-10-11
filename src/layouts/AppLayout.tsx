import { NavLink, Outlet } from "react-router";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const NAV_ITEMS = [
  { to: "/", label: "Inicio", end: true },
  { to: "/recuerdos", label: "Recuerdos" },
  { to: "/nosotros", label: "Nosotros" },
  { to: "/planes", label: "Planes" },
  { to: "/perfil", label: "Perfil" },
] as const;

/** Estructura mínima de la app. El diseño definitivo de layout y navegación es la Fase 3. */
export function AppLayout() {
  const online = useOnlineStatus();

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      {!online && (
        <p className="bg-lavender-100 px-4 py-2 text-center text-sm text-lavender-500">
          Sin conexión. Algunas cosas pueden no estar al día.
        </p>
      )}

      <main className="flex-1 px-4 pt-6 pb-28">
        <Outlet />
      </main>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 border-t border-blush-100 bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto flex max-w-lg justify-around">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={"end" in item}
                className={({ isActive }) =>
                  `block px-3 py-4 text-sm font-semibold transition-colors ${
                    isActive ? "text-blush-500" : "text-ink-soft hover:text-ink"
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
