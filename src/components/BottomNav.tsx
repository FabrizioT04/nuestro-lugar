import { NavLink } from "react-router";
import { BOTTOM_NAV } from "@/layouts/navigation";

/** Barra flotante oscura: todas las etiquetas siguen visibles, también en móvil. */
export function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <ul className="pointer-events-auto grid w-full max-w-md grid-cols-5 rounded-[1.75rem] bg-ink p-1.5 shadow-[0_10px_30px_rgb(20_17_19/0.25)]">
        {BOTTOM_NAV.map(({ to, label, icon: Icon }) => (
          <li key={to} className="min-w-0">
            <NavLink
              to={to}
              end={to === "/"}
              aria-label={label}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.375rem] text-[11px] font-medium transition-colors ${
                  isActive ? "bg-white/12 text-blush-300" : "text-white/60 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2 : 1.6} aria-hidden />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
