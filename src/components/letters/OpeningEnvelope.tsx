const FOLD = { transformBox: "fill-box", transformOrigin: "50% 0%" } as const;

/**
 * Sobre dibujado que se abre: la solapa se pliega hacia arriba y la carta sale de adentro.
 * Antes de abrir flota suave; `opening` arranca la animación.
 */
export function OpeningEnvelope({ opening, className = "" }: { opening: boolean; className?: string }) {
  return (
    <div className={`${opening ? "" : "animate-float"} ${className}`} aria-hidden data-testid="opening-envelope">
      <svg viewBox="0 -70 200 210" className="h-full w-full overflow-visible">
        {/* Fondo del sobre y la solapa ya abierta (detrás de la carta). */}
        <rect x="0" y="0" width="200" height="130" rx="12" fill="#f7b9c8" />
        {opening && <path d="M4 0 H196 L100 72 Z" fill="#ffc6d3" className="animate-flap-up" style={FOLD} />}
        {/* La carta. */}
        <g className={opening ? "animate-paper-rise" : undefined}>
          <rect x="18" y="12" width="164" height="110" rx="6" fill="#ffffff" />
          {[34, 48, 62, 76].map((y) => (
            <rect key={y} x="34" y={y} width={y === 76 ? 80 : 132} height="4" rx="2" fill="#ffe3ea" />
          ))}
          <path d="M100 98 c-4-5-12-5-12 1 0 5 12 11 12 11s12-6 12-11c0-6-8-6-12-1z" fill="#d42f58" />
        </g>
        {/* Bolsillo delantero. */}
        <path d="M0 26 L100 88 L200 26 V118 Q200 130 188 130 H12 Q0 130 0 118 Z" fill="#ffd6df" />
        <path d="M0 130 L84 78 M200 130 L116 78" stroke="#f7b9c8" strokeWidth="2" />
        {/* Solapa cerrada con su sello de corazón. */}
        <g className={opening ? "animate-flap-fold" : undefined} style={FOLD}>
          <path d="M4 0 H196 L100 72 Z" fill="#ffc6d3" />
          <circle cx="100" cy="62" r="14" fill="#d42f58" />
          <path d="M100 68 c-3-4-9-4-9 1 0 4 9 8 9 8s9-4 9-8c0-5-6-5-9-1z" fill="#ffffff" transform="translate(0 -9)" />
        </g>
      </svg>
    </div>
  );
}
