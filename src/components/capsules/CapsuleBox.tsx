export type CapsuleState = "locked" | "ready" | "opened";

const PALETTES: Record<CapsuleState, { box: string; lid: string; ribbon: string }> = {
  locked: { box: "#f3eeea", lid: "#e9e1db", ribbon: "var(--color-lavender-300)" },
  ready: { box: "var(--color-blush-50)", lid: "var(--color-blush-100)", ribbon: "var(--color-blush-300)" },
  opened: { box: "var(--color-paper)", lid: "var(--color-blush-50)", ribbon: "var(--color-blush-300)" },
};

interface Props {
  state: CapsuleState;
  className?: string;
}

/** Cajita de regalo ilustrada: con candado mientras espera su fecha, con lazo cuando ya se puede abrir y destapada al abrirla. */
export function CapsuleBox({ state, className = "" }: Props) {
  const colors = PALETTES[state];
  const opened = state === "opened";
  return (
    <svg viewBox="0 0 120 110" className={className} aria-hidden>
      {/* Caja */}
      <rect x="18" y="52" width="84" height="54" rx="8" fill={colors.box} stroke="var(--color-blush-200)" strokeWidth="1.5" />
      <rect x="54" y="52" width="12" height="54" fill={colors.ribbon} />

      {opened ? (
        <>
          {/* Tapa levantada y corazón que sale */}
          <g transform="rotate(-14 20 40)">
            <rect x="12" y="30" width="96" height="18" rx="6" fill={colors.lid} stroke="var(--color-blush-200)" strokeWidth="1.5" />
            <rect x="54" y="30" width="12" height="18" fill={colors.ribbon} />
          </g>
          <path
            d="M60 50 C48 41 46 34 50.5 29.5 C54 26 58.5 27.5 60 30.6 C61.5 27.5 66 26 69.5 29.5 C74 34 72 41 60 50 Z"
            fill="var(--color-blush-500)"
          />
          <circle cx="40" cy="22" r="2" fill="var(--color-lavender-300)" />
          <circle cx="84" cy="16" r="2.5" fill="var(--color-blush-300)" />
          <circle cx="92" cy="34" r="1.6" fill="var(--color-lavender-300)" />
        </>
      ) : (
        <>
          {/* Tapa y lazo */}
          <rect x="12" y="40" width="96" height="18" rx="6" fill={colors.lid} stroke="var(--color-blush-200)" strokeWidth="1.5" />
          <rect x="54" y="40" width="12" height="18" fill={colors.ribbon} />
          <path d="M60 40 C50 26 36 28 40 36 C43 42 54 41 60 40 Z" fill={colors.ribbon} />
          <path d="M60 40 C70 26 84 28 80 36 C77 42 66 41 60 40 Z" fill={colors.ribbon} />
          <circle cx="60" cy="40" r="5" fill={colors.ribbon} stroke={colors.box} strokeWidth="1.5" />
          {state === "locked" ? (
            <g>
              <circle cx="60" cy="81" r="12" fill="var(--color-ink-soft)" />
              <rect x="54.5" y="80" width="11" height="8" rx="1.5" fill="#fff" />
              <path d="M56.5 80 V77.5 a3.5 3.5 0 0 1 7 0 V80" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
            </g>
          ) : (
            <>
              <circle cx="22" cy="28" r="2.2" fill="var(--color-blush-300)" />
              <circle cx="100" cy="24" r="2.6" fill="var(--color-lavender-300)" />
              <circle cx="104" cy="44" r="1.6" fill="var(--color-blush-300)" />
            </>
          )}
        </>
      )}
    </svg>
  );
}
