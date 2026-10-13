import type { CSSProperties } from "react";
import { Heart } from "lucide-react";

/** Fondo de reserva discreto cuando todavía no hay una foto. */
export function CoverArt({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={`flex items-center justify-center bg-blush-50 text-blush-300 ${className}`} style={style} aria-hidden>
      <Heart strokeWidth={1.2} className="h-1/3 max-h-20 w-1/3 max-w-20" />
    </div>
  );
}
