export type EnvelopeState = "sealed" | "open-when" | "locked" | "opened";

const PALETTES: Record<EnvelopeState, { paper: string; flap: string; seal: string }> = {
  sealed: { paper: "var(--color-blush-50)", flap: "var(--color-blush-100)", seal: "var(--color-blush-500)" },
  "open-when": { paper: "var(--color-lavender-100)", flap: "#e2daf3", seal: "var(--color-lavender-500)" },
  locked: { paper: "#f3eeea", flap: "#e9e1db", seal: "var(--color-ink-soft)" },
  opened: { paper: "var(--color-paper)", flap: "var(--color-blush-50)", seal: "var(--color-blush-300)" },
};

interface Props {
  state: EnvelopeState;
  className?: string;
}

/** Sobre ilustrado. Cerrado lleva un sello de corazón (o un candado si está bloqueado); abierto, la solapa arriba. */
export function Envelope({ state, className = "" }: Props) {
  const colors = PALETTES[state];
  const opened = state === "opened";
  return (
    <svg viewBox="0 0 120 84" className={className} aria-hidden>
      {opened && (
        <>
          <path d="M6 30 L60 2 L114 30 Z" fill={colors.flap} stroke="var(--color-blush-200)" strokeWidth="1.5" strokeLinejoin="round" />
          <rect x="18" y="12" width="84" height="50" rx="4" fill="#fff" stroke="var(--color-blush-100)" />
          <path d="M28 26 H92 M28 36 H86 M28 46 H76" stroke="var(--color-blush-200)" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      <rect x="6" y="30" width="108" height="50" rx="8" fill={colors.paper} stroke="var(--color-blush-200)" strokeWidth="1.5" />
      <path d="M6 78 L50 50 M114 78 L70 50" stroke="var(--color-blush-200)" strokeWidth="1.5" fill="none" />
      {!opened && (
        <>
          <path d="M8 32 L60 64 L112 32" fill={colors.flap} stroke="var(--color-blush-200)" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="60" cy="60" r="11" fill={colors.seal} />
          {state === "locked" ? (
            <g stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round">
              <rect x="54.5" y="58" width="11" height="8" rx="1.5" fill="#fff" stroke="none" />
              <path d="M56.5 58 V55.5 a3.5 3.5 0 0 1 7 0 V58" />
            </g>
          ) : (
            <path
              d="M60 66 C54 61.5 53 58.5 55.2 56.2 C57 54.4 59.2 55.2 60 56.8 C60.8 55.2 63 54.4 64.8 56.2 C67 58.5 66 61.5 60 66 Z"
              fill="#fff"
            />
          )}
        </>
      )}
    </svg>
  );
}
