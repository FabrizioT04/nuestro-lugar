import { useState } from "react";
import { Link } from "react-router";
import { CalendarHeart, Camera, Mail, Plus } from "lucide-react";

const OPTIONS = [
  { to: "/planes/nuevo", label: "Plan", icon: CalendarHeart, tone: "bg-blush-50" },
  { to: "/cartas/nueva", label: "Carta", icon: Mail, tone: "bg-lavender-100" },
  { to: "/recuerdos/nuevo", label: "Recuerdo", icon: Camera, tone: "bg-blush-100" },
];

/** Botón "+" flotante de Inicio: al tocarlo se despliega en abanico con lo que se puede crear. */
export function QuickAdd() {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg">
      {open && <button type="button" aria-label="Cerrar" tabIndex={-1} onClick={() => setOpen(false)} className="pointer-events-auto fixed inset-0 animate-fade-in bg-white/60 backdrop-blur-[2px]" />}
      <div className="absolute right-5 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] flex flex-col items-end gap-3">
        {open && (
          <ul id="quick-add" className="flex flex-col items-end gap-2.5">
            {OPTIONS.map(({ to, label, icon: Icon, tone }, index) => (
              <li key={to} className="pointer-events-auto animate-fan-in" style={{ animationDelay: `${(OPTIONS.length - 1 - index) * 55}ms` }}>
                <Link to={to} className="flex items-center gap-3 rounded-full bg-paper py-1.5 pr-1.5 pl-4 text-sm font-semibold text-ink shadow-[0_6px_20px_rgb(20_17_19/0.15)]">
                  {label}
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full ${tone}`}>
                    <Icon size={19} aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          aria-label={open ? "Cerrar menú para crear" : "Crear algo nuevo"}
          aria-expanded={open}
          aria-controls="quick-add"
          onClick={() => setOpen((value) => !value)}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-blush-500 text-white shadow-[0_10px_25px_rgb(212_47_88/0.4)] transition active:scale-90"
        >
          <Plus size={26} strokeWidth={2.4} aria-hidden className={`transition-transform duration-300 ${open ? "rotate-[135deg]" : ""}`} />
        </button>
      </div>
    </div>
  );
}
