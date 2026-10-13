import type { CSSProperties } from "react";

/**
 * Ilustración suave que ocupa el lugar de la foto de la pareja hasta que puedan subirla (Fase 4).
 * Solo decorativa.
 */
export function CoverArt({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 400 300" className={className} style={style} aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="cover-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0f4" />
          <stop offset="0.55" stopColor="#ffe3ec" />
          <stop offset="1" stopColor="#ece6ff" />
        </linearGradient>
        <radialGradient id="cover-glow" cx="0.7" cy="0.25" r="0.6">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#cover-bg)" />
      <rect width="400" height="300" fill="url(#cover-glow)" />
      <circle cx="70" cy="240" r="90" fill="#f4ccd5" opacity="0.35" />
      <circle cx="350" cy="60" r="70" fill="#c9bce8" opacity="0.25" />
      {/* Dos corazones de línea que se cruzan */}
      <g fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M172 182s-38-23-38-50c0-14 10-24 23-24 7 0 12 3 15 8 3-5 8-8 15-8 13 0 23 10 23 24 0 27-38 50-38 50z"
          stroke="#e8a5b4"
        />
        <path
          d="M226 196s-38-23-38-50c0-14 10-24 23-24 7 0 12 3 15 8 3-5 8-8 15-8 13 0 23 10 23 24 0 27-38 50-38 50z"
          stroke="#c9bce8"
        />
      </g>
      <g fill="#ffffff" opacity="0.8">
        <circle cx="110" cy="70" r="2" />
        <circle cx="300" cy="200" r="2.5" />
        <circle cx="260" cy="90" r="1.5" />
        <circle cx="140" cy="230" r="1.5" />
      </g>
    </svg>
  );
}
