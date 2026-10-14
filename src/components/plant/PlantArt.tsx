import { useId, type CSSProperties, type ReactNode } from "react";
import type { PlantResponse } from "@shared/api";

// Lirio rosado (tipo "Stargazer") dibujado en SVG con detalle realista: pétalos con base magenta,
// borde blanco, pecas y punta curvada; estambres con anteras óxido; hojas brillantes con nervaduras;
// maceta de barro con su sombra. Se mueve suave con la brisa y reacciona al riego.

const BASE = { x: 120, y: 214 };
const STEM_HEIGHT = [0, 30, 64, 102, 130, 140, 144];
const LEAF_COUNT = [0, 0, 3, 5, 8, 8, 8];
/** Flores extra alrededor de la punta: [dx, dy, giro]. */
const CLUSTER: [number, number, number][] = [
  [-38, 32, -30],
  [40, 36, 28],
  [-32, 64, -40],
  [36, 68, 36],
  [-42, 94, -44],
  [42, 98, 42],
];

const PETAL =
  "M0 0 C 6 -4, 13 -14, 14 -26 C 15 -36, 10 -45, 2 -52 C 0 -53.5, -2 -53, -3 -51 C -11 -43, -15 -33, -14 -23 C -13 -12, -6 -4, 0 0 Z";
const LEAF = "M0 0 C 14 -8, 34 -12, 52 -10 C 62 -9, 68 -6, 73 -2 C 64 1, 50 5, 32 5.5 C 16 6, 6 4, 0 0 Z";

interface Props {
  plant: Pick<PlantResponse, "stage" | "flowers" | "mood">;
  /** Muestra la regadera y las gotas (al regarla). */
  watering?: boolean;
}

type Point = { x: number; y: number };

/** Números pseudoaleatorios estables (mismo dibujo en cada render). */
function seeded(seed: number) {
  let value = seed % 2147483647 || 1;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}

export function PlantArt({ plant, watering = false }: Props) {
  const id = useId().replace(/:/g, "");
  const stage = plant.stage.index;
  const thirst = plant.mood === "happy" ? 0 : plant.mood === "thirsty" ? 1 : 2;
  const height = STEM_HEIGHT[stage] ?? 0;
  const bend = thirst * 18;
  const tip = { x: BASE.x + bend, y: BASE.y - height + thirst * 12 };
  const control = { x: BASE.x - 6 + bend * 0.2, y: BASE.y - height * 0.55 };
  const pointAt = (t: number): Point => ({
    x: (1 - t) ** 2 * BASE.x + 2 * (1 - t) * t * control.x + t ** 2 * tip.x,
    y: (1 - t) ** 2 * BASE.y + 2 * (1 - t) * t * control.y + t ** 2 * tip.y,
  });

  const count = LEAF_COUNT[stage] ?? 0;
  const leaves = Array.from({ length: count }, (_, i) => {
    const t = 0.2 + (i / Math.max(1, count)) * 0.66;
    const side: 1 | -1 = i % 2 === 0 ? -1 : 1;
    const scale = 0.92 - (i / Math.max(1, count)) * 0.42;
    const angle = [-26, 0, 24][thirst]! - (i / Math.max(1, count)) * 24 + (i % 3) * 5;
    return { ...pointAt(t), side, scale, angle, delay: (i * 0.41) % 2.4 };
  });

  const extra = Math.max(0, plant.flowers - 1);
  const happy = thirst === 0;
  const sway: CSSProperties = { transformBox: "view-box", transformOrigin: `${BASE.x}px ${BASE.y}px` };
  const saturation = [1, 0.62, 0.35][thirst]!;

  return (
    <svg viewBox="0 0 240 290" role="img" aria-label={`${plant.stage.name}${thirst > 0 ? ", con sed" : ""}`} className="mx-auto h-auto w-full max-w-64">
      <PlantDefs id={id} saturation={saturation} />

      {/* Sombra en el suelo. */}
      <ellipse cx="122" cy="279" rx="62" ry="6" fill="#2b1a14" opacity="0.18" filter={`url(#${id}-soft)`} />

      <g filter={`url(#${id}-thirst)`}>
        <g className={watering ? "animate-happy-grow" : undefined} style={sway}>
          <g className={happy && stage > 0 ? "animate-plant-sway" : undefined} style={sway}>
            {stage > 0 && <path d={taperedStem(BASE, control, tip, stage > 2 ? 3.4 : 2.4)} fill={`url(#${id}-stem)`} />}

            {stage === 1 && (
              <>
                <Leaf id={id} x={tip.x} y={tip.y + 5} side={-1} scale={0.4} angle={-64} delay={0} flutter={happy} />
                <Leaf id={id} x={tip.x} y={tip.y + 5} side={1} scale={0.36} angle={-60} delay={0.8} flutter={happy} />
              </>
            )}
            {leaves.map((leaf, index) => (
              <Leaf key={index} id={id} {...leaf} flutter={happy} />
            ))}

            {/* Punta que sigue creciendo antes del botón: hojitas apretadas. */}
            {stage >= 2 && stage < 4 && (
              <g>
                <path d={`M${tip.x - 3} ${tip.y + 3} C ${tip.x - 4} ${tip.y - 8}, ${tip.x - 1.5} ${tip.y - 16}, ${tip.x} ${tip.y - 20} C ${tip.x + 1.5} ${tip.y - 16}, ${tip.x + 4} ${tip.y - 8}, ${tip.x + 3} ${tip.y + 3} Z`} fill={`url(#${id}-leaf)`} />
                <path d={`M${tip.x} ${tip.y + 2} L${tip.x} ${tip.y - 17}`} stroke="#d8ecd2" strokeOpacity="0.5" strokeWidth="0.8" />
              </g>
            )}

            {CLUSTER.slice(0, extra).map(([dx, dy], index) => (
              <path
                key={`pedicel-${index}`}
                d={`M${tip.x - bend * 0.15} ${tip.y + dy + 18} Q ${tip.x + dx * 0.45} ${tip.y + dy + 14} ${tip.x + dx} ${tip.y + dy}`}
                fill="none"
                stroke={`url(#${id}-stem)`}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            ))}
            {CLUSTER.slice(0, extra).map(([dx, dy, turn], index) => (
              <Flower key={index} id={id} x={tip.x + dx} y={tip.y + dy} size={0.56} turn={turn + thirst * 22} droop={thirst} delay={0.6 + index * 0.45} sway={happy} seed={index + 2} />
            ))}
            {stage === 4 && <Bud id={id} x={tip.x} y={tip.y} sway={happy} />}
            {stage >= 5 && <Flower id={id} x={tip.x} y={tip.y} size={1} turn={-6 + thirst * 30} droop={thirst} delay={0} sway={happy} seed={1} />}
          </g>
        </g>
      </g>

      <Pot id={id} wet={watering} />
      {stage === 0 && <Bulb id={id} />}
      {watering && <WateringCan id={id} />}
    </svg>
  );
}

function PlantDefs({ id, saturation }: { id: string; saturation: number }) {
  return (
    <defs>
      <filter id={`${id}-soft`} x="-20%" y="-50%" width="140%" height="200%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
      <filter id={`${id}-blur1`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="0.8" />
      </filter>
      {/* Con sed los colores se apagan. */}
      <filter id={`${id}-thirst`} x="-10%" y="-10%" width="120%" height="120%">
        <feColorMatrix type="saturate" values={String(saturation)} />
      </filter>
      <filter id={`${id}-petalShadow`} x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodColor="#5c0b2c" floodOpacity="0.38" />
      </filter>
      <filter id={`${id}-soilTexture`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="4" />
        <feColorMatrix values="0 0 0 0 0.18  0 0 0 0 0.11  0 0 0 0 0.07  0 0 0 1.4 -0.45" />
      </filter>
      <clipPath id={`${id}-petalClip`}>
        <path d={PETAL} />
      </clipPath>
      <clipPath id={`${id}-leafClip`}>
        <path d={LEAF} />
      </clipPath>
      <clipPath id={`${id}-soilClip`}>
        <ellipse cx="120" cy="208.5" rx="51" ry="6.5" />
      </clipPath>

      <linearGradient id={`${id}-petal`} x1="0.5" y1="1" x2="0.5" y2="0">
        <stop offset="0" stopColor="#9c1145" />
        <stop offset="0.22" stopColor="#cf2f6c" />
        <stop offset="0.5" stopColor="#ec6f9b" />
        <stop offset="0.8" stopColor="#f9c3d6" />
        <stop offset="1" stopColor="#fff3f7" />
      </linearGradient>
      <linearGradient id={`${id}-petalSide`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#5c0b2c" stopOpacity="0.4" />
        <stop offset="0.45" stopColor="#5c0b2c" stopOpacity="0" />
        <stop offset="0.75" stopColor="#ffffff" stopOpacity="0.12" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${id}-throat`}>
        <stop offset="0" stopColor="#e9f3c9" />
        <stop offset="0.6" stopColor="#c7dc95" />
        <stop offset="1" stopColor="#c7dc95" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-anther`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#7a2e12" />
        <stop offset="0.5" stopColor="#b9531f" />
        <stop offset="1" stopColor="#8a3816" />
      </linearGradient>

      <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2f6a45" />
        <stop offset="0.45" stopColor="#4f8f60" />
        <stop offset="1" stopColor="#7cb585" />
      </linearGradient>
      <linearGradient id={`${id}-stem`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#2c623f" />
        <stop offset="0.4" stopColor="#6ea877" />
        <stop offset="1" stopColor="#356e47" />
      </linearGradient>
      <linearGradient id={`${id}-bud`} x1="0.5" y1="1" x2="0.5" y2="0">
        <stop offset="0" stopColor="#4f8f60" />
        <stop offset="0.45" stopColor="#a9c98e" />
        <stop offset="0.75" stopColor="#e9b3c4" />
        <stop offset="1" stopColor="#d65c86" />
      </linearGradient>
      <linearGradient id={`${id}-budSide`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#1f4a2e" stopOpacity="0.35" />
        <stop offset="0.5" stopColor="#1f4a2e" stopOpacity="0" />
        <stop offset="0.7" stopColor="#ffffff" stopOpacity="0.25" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>

      <linearGradient id={`${id}-pot`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#8f452c" />
        <stop offset="0.3" stopColor="#d1825f" />
        <stop offset="0.45" stopColor="#dc9473" />
        <stop offset="0.75" stopColor="#b8643f" />
        <stop offset="1" stopColor="#7f3b25" />
      </linearGradient>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#9a4c31" />
        <stop offset="0.35" stopColor="#e0997a" />
        <stop offset="0.5" stopColor="#e6a486" />
        <stop offset="0.8" stopColor="#c06b46" />
        <stop offset="1" stopColor="#8a412a" />
      </linearGradient>
      <radialGradient id={`${id}-soil`} cx="0.5" cy="0.35" r="0.75">
        <stop offset="0" stopColor="#5a3b2a" />
        <stop offset="1" stopColor="#2e1d14" />
      </radialGradient>
      <linearGradient id={`${id}-bulb`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#c9a77c" />
        <stop offset="0.45" stopColor="#f3e3c6" />
        <stop offset="1" stopColor="#b8956a" />
      </linearGradient>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#dfe8ef" />
        <stop offset="0.5" stopColor="#9fb3c2" />
        <stop offset="1" stopColor="#6f8597" />
      </linearGradient>
    </defs>
  );
}

/** Tallo más grueso abajo que arriba, siguiendo la curva. */
function taperedStem(base: Point, control: Point, tip: Point, width: number): string {
  const left: string[] = [];
  const right: string[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) ** 2 * base.x + 2 * (1 - t) * t * control.x + t ** 2 * tip.x;
    const y = (1 - t) ** 2 * base.y + 2 * (1 - t) * t * control.y + t ** 2 * tip.y;
    const dx = 2 * (1 - t) * (control.x - base.x) + 2 * t * (tip.x - control.x);
    const dy = 2 * (1 - t) * (control.y - base.y) + 2 * t * (tip.y - control.y);
    const length = Math.hypot(dx, dy) || 1;
    const half = width * (1 - t * 0.6);
    const nx = (-dy / length) * half;
    const ny = (dx / length) * half;
    left.push(`${(x + nx).toFixed(1)} ${(y + ny).toFixed(1)}`);
    right.unshift(`${(x - nx).toFixed(1)} ${(y - ny).toFixed(1)}`);
  }
  return `M${left.join(" L")} L${right.join(" L")} Z`;
}

function Animated({ className, origin, delay, children }: { className?: string; origin: string; delay: number; children: ReactNode }) {
  // La animación usa transform: va en un grupo sin transform propio.
  return (
    <g className={className} style={{ transformBox: "fill-box", transformOrigin: origin, animationDelay: `${delay}s` }}>
      {children}
    </g>
  );
}

function Leaf({ id, x, y, side, scale, angle, delay, flutter }: { id: string; x: number; y: number; side: 1 | -1; scale: number; angle: number; delay: number; flutter: boolean }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${side} 1) rotate(${angle.toFixed(1)}) scale(${scale.toFixed(2)})`}>
      <Animated className={flutter ? "animate-leaf-flutter" : undefined} origin="0% 60%" delay={delay}>
        <path d={LEAF} fill={`url(#${id}-leaf)`} />
        <g clipPath={`url(#${id}-leafClip)`}>
          {/* Nervaduras paralelas y brillo de hoja encerada. */}
          <path d="M2 0 C 22 -5, 46 -8, 72 -2" fill="none" stroke="#244f33" strokeOpacity="0.55" strokeWidth="1" />
          <path d="M6 2.5 C 24 0, 46 -2, 66 0" fill="none" stroke="#244f33" strokeOpacity="0.22" strokeWidth="0.6" />
          <path d="M6 -3 C 24 -8, 44 -10, 62 -6" fill="none" stroke="#244f33" strokeOpacity="0.22" strokeWidth="0.6" />
          <path d="M10 -4 C 26 -9, 42 -10, 56 -8" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2.2" filter={`url(#${id}-blur1)`} />
        </g>
      </Animated>
    </g>
  );
}

function Bud({ id, x, y, sway }: { id: string; x: number; y: number; sway: boolean }) {
  const shape = "M0 3 C -9 -4, -10 -24, -4 -42 C -2 -48, 2 -48, 4 -42 C 10 -24, 9 -4, 0 3 Z";
  return (
    <g transform={`translate(${x} ${y}) rotate(-6)`}>
      <Animated className={sway ? "animate-flower-bob" : undefined} origin="50% 100%" delay={0}>
        <path d={shape} fill={`url(#${id}-bud)`} />
        <path d={shape} fill={`url(#${id}-budSide)`} />
        {/* Las tres costuras de los pétalos todavía cerrados. */}
        <path d="M-1 1 C -3 -14, -3 -30, -1 -44" fill="none" stroke="#2f6a45" strokeOpacity="0.35" strokeWidth="0.8" />
        <path d="M-5 -2 C -8 -14, -7 -30, -3 -41" fill="none" stroke="#2f6a45" strokeOpacity="0.25" strokeWidth="0.7" />
        <path d="M4 -2 C 6 -14, 6 -30, 2 -42" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.2" />
      </Animated>
    </g>
  );
}

function Petal({ id, angle, length, seed, back }: { id: string; angle: number; length: number; seed: number; back: boolean }) {
  const random = seeded(seed * 97 + angle);
  const spots = Array.from({ length: 16 }, () => {
    const y = -5 - random() * 24;
    const spread = 2 + (-y / 26) * 8;
    return { x: (random() * 2 - 1) * spread, y, r: 0.45 + random() * 1.05 };
  });
  return (
    <g transform={`rotate(${angle}) scale(${(length / 52).toFixed(3)})`}>
      <path d={PETAL} fill={`url(#${id}-petal)`} />
      <g clipPath={`url(#${id}-petalClip)`}>
        <path d={PETAL} fill={`url(#${id}-petalSide)`} />
        {/* Borde blanco suave, como el de un lirio de verdad. */}
        <path d={PETAL} fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="3.2" filter={`url(#${id}-blur1)`} />
        {/* Nervio central: canal verde en la base y línea clara hacia la punta. */}
        <path d="M0 -1 C 0.4 -16, 1 -30, 0.4 -46" fill="none" stroke="#ffe3ec" strokeOpacity="0.75" strokeWidth="1.6" filter={`url(#${id}-blur1)`} />
        <path d="M0 -1 L 0.2 -13" stroke="#c8dc8e" strokeOpacity="0.85" strokeWidth="2.2" strokeLinecap="round" />
        {spots.map((spot, index) => (
          <g key={index}>
            <circle cx={spot.x.toFixed(2)} cy={spot.y.toFixed(2)} r={spot.r.toFixed(2)} fill="#7d0b37" opacity="0.85" />
            <circle cx={(spot.x - spot.r * 0.3).toFixed(2)} cy={(spot.y - spot.r * 0.3).toFixed(2)} r={(spot.r * 0.35).toFixed(2)} fill="#ffd0e0" opacity="0.6" />
          </g>
        ))}
        {/* La punta se curva hacia atrás y le da la luz. */}
        <ellipse cx="0" cy="-48" rx="5" ry="4" fill="#ffffff" opacity="0.55" filter={`url(#${id}-blur1)`} />
        {back && <path d={PETAL} fill="#3d0a1f" opacity="0.14" />}
      </g>
    </g>
  );
}

/** Lirio abierto en tres cuartos: seis pétalos en dos capas, garganta verde, estambres y pistilo. */
function Flower({ id, x, y, size, turn, droop, delay, sway, seed }: { id: string; x: number; y: number; size: number; turn: number; droop: number; delay: number; sway: boolean; seed: number }) {
  const squash = droop > 1 ? 0.72 : 0.82;
  const stamens = [-58, -32, -8, 16, 40, 64];
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${turn}) scale(${size} ${(size * squash).toFixed(3)})`}>
      <Animated className={sway ? "animate-flower-bob" : undefined} origin="50% 50%" delay={delay}>
        {[0, 120, 240].map((angle) => (
          <Petal key={angle} id={id} angle={angle + 4} length={56} seed={seed} back />
        ))}
        <g filter={`url(#${id}-petalShadow)`}>
          {[60, 180, 300].map((angle) => (
            <Petal key={angle} id={id} angle={angle - 4} length={52} seed={seed + 5} back={false} />
          ))}
        </g>
        <circle r="9" fill={`url(#${id}-throat)`} />
        {stamens.map((angle, index) => {
          const length = 30 + (index % 3) * 4;
          const curl = index % 2 ? 6 : -6;
          return (
            <g key={angle} transform={`rotate(${angle})`}>
              <path d={`M0 -2 Q ${curl} ${-length * 0.55} ${curl * 0.4} ${-length}`} fill="none" stroke="#e6efcf" strokeWidth="1.3" strokeLinecap="round" />
              <ellipse cx={curl * 0.4} cy={-length - 2} rx="1.7" ry="4.2" fill={`url(#${id}-anther)`} transform={`rotate(${curl * 6} ${curl * 0.4} ${-length - 2})`} />
            </g>
          );
        })}
        <path d="M0 -2 Q 3 -18 1 -36" fill="none" stroke="#d3e4b0" strokeWidth="2.2" strokeLinecap="round" />
        <g transform="translate(1 -37)">
          {[0, 120, 240].map((angle) => (
            <ellipse key={angle} cx="0" cy="-1.6" rx="1.5" ry="2.2" fill="#b4cc84" transform={`rotate(${angle})`} />
          ))}
        </g>
      </Animated>
    </g>
  );
}

/** Maceta de barro: cuerpo con volumen, borde grueso y tierra con textura. */
function Pot({ id, wet }: { id: string; wet: boolean }) {
  return (
    <g>
      <path d="M70 218 H170 L160 270 Q158 278 149 278 H91 Q82 278 80 270 Z" fill={`url(#${id}-pot)`} />
      {/* Sombra que proyecta el borde sobre el cuerpo. */}
      <path d="M71 218 H169 L167 228 Q120 233 73 228 Z" fill="#3b170c" opacity="0.28" filter={`url(#${id}-blur1)`} />
      <path d="M62 204 Q62 198 68 198 H172 Q178 198 178 204 V214 Q178 220 172 220 H68 Q62 220 62 214 Z" fill={`url(#${id}-rim)`} />
      <path d="M64 200.5 H176" stroke="#f6c3aa" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="120" cy="207.5" rx="53" ry="7.5" fill="#5e2a18" />
      <ellipse cx="120" cy="208.5" rx="51" ry="6.5" fill={`url(#${id}-soil)`} />
      <g clipPath={`url(#${id}-soilClip)`}>
        <rect x="68" y="201" width="104" height="15" filter={`url(#${id}-soilTexture)`} />
      </g>
      {wet && <ellipse cx="120" cy="208.5" rx="51" ry="6.5" fill="#160b06" className="animate-soil-wet" />}
    </g>
  );
}

/** Bulbo asomando en la tierra, con sus escamas. */
function Bulb({ id }: { id: string }) {
  return (
    <g>
      <ellipse cx="120" cy="208" rx="16" ry="3" fill="#24150e" opacity="0.6" />
      {[
        "M120 186 C 128 192, 133 199, 131 205 C 129 210, 111 210, 109 205 C 107 199, 112 192, 120 186 Z",
        "M114 191 C 109 196, 108 202, 111 207 L 118 207 C 115 202, 114 196, 114 191 Z",
        "M126 191 C 131 196, 132 202, 129 207 L 122 207 C 125 202, 126 196, 126 191 Z",
      ].map((d, index) => (
        <path key={index} d={d} fill={`url(#${id}-bulb)`} stroke="#9c7b52" strokeOpacity="0.55" strokeWidth="0.7" />
      ))}
      <path d="M120 186 C 121 182, 122 180, 123 179" fill="none" stroke="#7fa86a" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

/** Regadera de metal que aparece, se inclina, deja caer gotas y se va. */
function WateringCan({ id }: { id: string }) {
  return (
    <g>
      <g transform="translate(178 86)">
        <g className="animate-can-pour" style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}>
          <path d="M-14 -10 H14 Q18 -10 18 -6 V12 Q18 16 14 16 H-14 Q-18 16 -18 12 V-6 Q-18 -10 -14 -10 Z" fill={`url(#${id}-metal)`} />
          <path d="M-18 -2 L-38 -16 L-40 -12 L-20 4 Z" fill={`url(#${id}-metal)`} />
          <ellipse cx="-40" cy="-14" rx="3" ry="5" fill="#7d93a5" transform="rotate(-35 -40 -14)" />
          <path d="M-6 -10 Q 0 -24 10 -10" fill="none" stroke="#8ca1b2" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M-12 -5 H8" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      </g>
      <g fill="#a9d4ef" opacity="0.9">
        {[132, 138, 126, 142, 129, 136].map((dropX, index) => (
          <g key={index} transform={`translate(${dropX} 112)`}>
            <path d="M0 -6 C 3.5 -1, 4.5 2, 0 5 C -4.5 2, -3.5 -1, 0 -6 Z" className="animate-water-drop" style={{ animationDelay: `${250 + index * 110}ms` }} />
          </g>
        ))}
      </g>
    </g>
  );
}
