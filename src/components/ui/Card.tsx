import type { HTMLAttributes } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** false para contenido que llega hasta el borde (por ejemplo, una foto). */
  padded?: boolean;
}

export function Card({ className = "", padded = true, ...props }: Props) {
  return <div className={`rounded-card border border-blush-200 bg-paper ${padded ? "p-5" : ""} ${className}`} {...props} />;
}
