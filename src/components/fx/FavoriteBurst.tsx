import type { CSSProperties } from "react";

const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** Chispitas que salen del corazón al marcar un favorito. Se monta de nuevo con cada "me gusta". */
export function FavoriteBurst() {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden data-testid="favorite-burst">
      {ANGLES.map((angle, index) => (
        <span
          key={angle}
          className={`absolute block animate-spark rounded-full ${index % 2 ? "h-1.5 w-1.5 bg-blush-300" : "h-2 w-2 bg-blush-500"}`}
          style={{ "--angle": `${angle}deg` } as CSSProperties}
        />
      ))}
    </span>
  );
}
