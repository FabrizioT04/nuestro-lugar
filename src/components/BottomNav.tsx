import { NavLink } from "react-router";
import { BOTTOM_NAV } from "@/layouts/navigation";

/** Navegación estable: todas las etiquetas siguen visibles, también en móvil. */
export function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center"
    >
      <ul className="pointer-events-auto grid w-full max-w-lg grid-cols-5 border-t border-blush-200 bg-paper px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {BOTTOM_NAV.map(({ to, label, icon: Icon }) => (
          <li key={to} className="min-w-0">
            <NavLink
              to={to}
              end={to === "/"}
              aria-label={label}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors ${
                  isActive ? "bg-blush-50 text-blush-700" : "text-ink-soft hover:text-ink"
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
