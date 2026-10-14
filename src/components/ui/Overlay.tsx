import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Hoja que sube desde abajo (en el teléfono) o ventana centrada (en la PC). */
export function Overlay({ label, onClose, children }: { label: string; onClose?: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // En un portal: la animación de cambio de pantalla crea su propio apilamiento y la barra de abajo quedaría encima.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="animate-pop-in relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-paper/90 text-ink-soft shadow-sm">
            <X size={18} aria-hidden />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
