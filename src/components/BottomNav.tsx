import { NavLink } from "react-router";
import { BOTTOM_NAV } from "@/layouts/navigation";

/** Barra flotante tipo píldora: blanca, con la sección activa en rosado suave y su nombre. */
export function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <ul className="pointer-events-auto flex items-center gap-1 rounded-full border border-blush-100 bg-paper/92 p-2 shadow-[0_16px_30px_-14px_rgb(212_106_140/0.45)] backdrop-blur-md">
        {BOTTOM_NAV.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              aria-label={label}
              className={({ isActive }) =>
                `flex h-11 items-center justify-center gap-1.5 rounded-full text-[13px] font-extrabold transition-all ${
                  isActive ? "animate-pop-in bg-blush-100 px-4 text-blush-700" : "w-12 text-ink-soft/70 hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
                  {isActive && <span className="animate-pop-in">{label}</span>}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
