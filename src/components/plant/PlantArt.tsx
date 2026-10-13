import { useId, type CSSProperties } from "react";
import type { PlantResponse } from "@shared/api";

// Ilustración del lirio según su etapa y su ánimo. Todo en SVG (sin imágenes): degradados suaves,
// trazo un poco irregular como dibujado a mano y movimiento de brisa en cada hoja y cada flor.

const BASE = { x: 120, y: 214 };
const STEM_HEIGHT = [0, 30, 62, 100, 128, 138, 142];
const LEAF_COUNT = [0, 0, 3, 5, 7, 7, 7];
/** Flores extra alrededor de la punta: [dx, dy, giro]. */
const CLUSTER: [number, number, number][] = [
  [-36, 30, -28],
  [38, 34, 26],
  [-30, 62, -36],
  [34, 66, 32],
  [-40, 92, -40],
  [40, 96, 38],
];

/** Hoja de lirio: larga, angosta y un poco curvada, con la base en (0, 0). */
const LEAF = "M0 0 C 10 -9, 28 -14, 46 -12 C 56 -11, 63 -7, 68 -2 C 58 1, 44 4, 30 4.5 C 16 5, 6 3.5, 0 0 Z";
const LEAF_VEIN = "M2 0 C 20 -5, 42 -8, 66 -3";

interface Props {
  plant: Pick<PlantResponse, "stage" | "flowers" | "mood">;
  /** Muestra la regadera y las gotas (al regarla). */
  watering?: boolean;
}

type Point = { x: number; y: number };

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

  const leaves = Array.from({ length: LEAF_COUNT[stage] ?? 0 }, (_, i) => {
    const count = LEAF_COUNT[stage] ?? 1;
    const t = 0.18 + (i / count) * 0.68;
    const side: 1 | -1 = i % 2 === 0 ? -1 : 1;
    // Las de abajo más grandes y abiertas; las de arriba chicas y paradas.
    const scale = 0.95 - (i / count) * 0.45;
    const lift = [-30, -2, 26][thirst]! - (i / count) * 22 + (i % 3) * 4;
    return { ...pointAt(t), side, scale, angle: lift, delay: (i * 0.37) % 2.2 };
  });

  const extra = Math.max(0, plant.flowers - 1);
  const happy = thirst === 0;
  const colors = thirst === 0 ? HAPPY : thirst === 1 ? THIRSTY : VERY_THIRSTY;
  const sway: CSSProperties = { transformBox: "view-box", transformOrigin: `${BASE.x}px ${BASE.y}px` };

  return (
    <svg viewBox="0 0 240 290" role="img" aria-label={`${plant.stage.name}${thirst > 0 ? ", con sed" : ""}`} className="mx-auto h-auto w-full max-w-64">
      <defs>
        <filter id={`${id}-hand`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={colors.leafDark} />
          <stop offset="1" stopColor={colors.leafLight} />
        </linearGradient>
        <linearGradient id={`${id}-stem`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={colors.leafDark} />
          <stop offset="0.6" stopColor={colors.leafLight} />
          <stop offset="1" stopColor={colors.leafDark} />
        </linearGradient>
        <linearGradient id={`${id}-petal-back`} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0" stopColor={colors.petalDeep} />
          <stop offset="0.45" stopColor={colors.petalMid} />
          <stop offset="1" stopColor={colors.petalEdge} />
        </linearGradient>
        <linearGradient id={`${id}-petal`} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0" stopColor={colors.petalDeep} />
          <stop offset="0.35" stopColor={colors.petalMid} />
          <stop offset="0.85" stopColor={colors.petalEdge} />
          <stop offset="1" stopColor="#fffafc" />
        </linearGradient>
        <linearGradient id={`${id}-bud`} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0" stopColor={colors.leafLight} />
          <stop offset="0.55" stopColor="#e8eed4" />
          <stop offset="1" stopColor={colors.petalMid} />
        </linearGradient>
        <linearGradient id={`${id}-pot`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d98c74" />
          <stop offset="0.35" stopColor="#efb39d" />
          <stop offset="0.7" stopColor="#e09a82" />
          <stop offset="1" stopColor="#c4775f" />
        </linearGradient>
        <radialGradient id={`${id}-soil`} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#8a6047" />
          <stop offset="1" stopColor="#5e3f2f" />
        </radialGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe3ec" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe3ec" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Halo suave detrás de la planta cuando está feliz y en flor. */}
      {happy && stage >= 5 && <circle cx={tip.x} cy={tip.y + 30} r="90" fill={`url(#${id}-glow)`} />}

      <ellipse cx="120" cy="280" rx="64" ry="5" fill="#382931" opacity="0.07" />

      <g filter={`url(#${id}-hand)`}>
        <g className={watering ? "animate-happy-grow" : undefined} style={sway}>
          <g className={happy && stage > 0 ? "animate-plant-sway" : undefined} style={sway}>
            {stage > 0 && <path d={taperedStem(BASE, control, tip, stage > 2 ? 3.6 : 2.6)} fill={`url(#${id}-stem)`} />}

            {stage === 1 && (
              <>
                <Leaf id={id} x={tip.x} y={tip.y + 4} side={-1} scale={0.42} angle={-62} delay={0} flutter={happy} />
                <Leaf id={id} x={tip.x} y={tip.y + 4} side={1} scale={0.38} angle={-58} delay={0.8} flutter={happy} />
              </>
            )}
            {leaves.map((leaf, index) => (
              <Leaf key={index} id={id} {...leaf} flutter={happy} />
            ))}

            {/* Punta que sigue creciendo antes del botón. */}
            {stage >= 2 && stage < 4 && (
              <path d={`M${tip.x - 2.4} ${tip.y + 2} C ${tip.x - 3} ${tip.y - 8}, ${tip.x - 1} ${tip.y - 15}, ${tip.x} ${tip.y - 18} C ${tip.x + 1} ${tip.y - 15}, ${tip.x + 3} ${tip.y - 8}, ${tip.x + 2.4} ${tip.y + 2} Z`} fill={colors.leafLight} />
            )}

            {extra > 0 &&
              CLUSTER.slice(0, extra).map(([dx, dy], index) => (
                <path
                  key={`pedicel-${index}`}
                  d={`M${tip.x - bend * 0.15} ${tip.y + dy + 16} Q ${tip.x + dx * 0.5} ${tip.y + dy + 12} ${tip.x + dx} ${tip.y + dy}`}
                  fill="none"
                  stroke={colors.leafDark}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              ))}
            {CLUSTER.slice(0, extra).map(([dx, dy, turn], index) => (
              <Flower key={index} id={id} x={tip.x + dx} y={tip.y + dy} size={0.58} turn={turn + thirst * 20} droop={thirst} delay={0.6 + index * 0.45} sway={happy} />
            ))}
            {stage === 4 && <Bud id={id} x={tip.x} y={tip.y} sway={happy} />}
            {stage >= 5 && <Flower id={id} x={tip.x} y={tip.y} size={1} turn={thirst * 30} droop={thirst} delay={0} sway={happy} />}
          </g>
        </g>

        {/* Maceta de barro con su borde y la tierra. */}
        <path d="M70 216 H170 L160 268 Q158 276 150 276 H90 Q82 276 80 268 Z" fill={`url(#${id}-pot)`} />
        <path d="M84 232 Q120 240 156 232" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round" />
        <path d="M62 206 Q62 200 68 200 H172 Q178 200 178 206 V214 Q178 220 172 220 H68 Q62 220 62 214 Z" fill="#d48a72" />
        <path d="M66 204 H174" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="120" cy="209" rx="53" ry="6" fill={`url(#${id}-soil)`} />
        {[96, 108, 131, 142, 117].map((x, index) => (
          <circle key={x} cx={x} cy={208 + (index % 2)} r="1.1" fill="#b48a6c" />
        ))}
        {watering && <ellipse cx="120" cy="209" rx="53" ry="6" fill="#3d2618" className="animate-soil-wet" />}

        {stage === 0 && (
          <g>
            <path d="M106 210 Q120 199 134 210 Z" fill="#7a5340" />
            <path d="M120 189 C 127 195, 131 200, 130 205 C 128 210, 112 210, 110 205 C 109 200, 113 195, 120 189 Z" fill="#efe1c4" stroke="#cdb28a" strokeWidth="1.4" />
            <path d="M120 190 C 122 195, 122 201, 120 207" fill="none" stroke="#d9c39c" strokeWidth="1.2" />
          </g>
        )}
      </g>

      {/* Brillitos cuando está feliz y en flor. */}
      {happy && stage >= 5 &&
        SPARKLES.map(([dx, dy, delay], index) => (
          <path
            key={index}
            d="M0 -5 Q 1 -1 5 0 Q 1 1 0 5 Q -1 1 -5 0 Q -1 -1 0 -5 Z"
            fill="#ffd27a"
            transform={`translate(${tip.x + dx} ${tip.y + dy})`}
          >
            <animate attributeName="opacity" values="0;1;0" dur="2.6s" begin={`${delay}s`} repeatCount="indefinite" />
          </path>
        ))}

      {watering && <WateringCan />}
    </svg>
  );
}

const SPARKLES: [number, number, number][] = [
  [-52, -6, 0],
  [50, -18, 0.9],
  [-18, -46, 1.7],
  [32, 20, 1.2],
];

const HAPPY = { leafDark: "#3f7d5a", leafLight: "#86c08f", petalDeep: "#c2185b", petalMid: "#f48fb1", petalEdge: "#ffe4ee" };
const THIRSTY = { leafDark: "#5f8a5a", leafLight: "#a3bf86", petalDeep: "#c75a82", petalMid: "#f1a9c1", petalEdge: "#fbe9ef" };
const VERY_THIRSTY = { leafDark: "#7f8a55", leafLight: "#bdb985", petalDeep: "#b9849a", petalMid: "#e3bccb", petalEdge: "#f6ecef" };

/** Tallo más grueso abajo que arriba, siguiendo la curva. */
function taperedStem(base: Point, control: Point, tip: Point, width: number): string {
  const left: string[] = [];
  const right: string[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) ** 2 * base.x + 2 * (1 - t) * t * control.x + t ** 2 * tip.x;
    const y = (1 - t) ** 2 * base.y + 2 * (1 - t) * t * control.y + t ** 2 * tip.y;
    const dx = 2 * (1 - t) * (control.x - base.x) + 2 * t * (tip.x - control.x);
    const dy = 2 * (1 - t) * (control.y - base.y) + 2 * t * (tip.y - control.y);
    const length = Math.hypot(dx, dy) || 1;
    const half = width * (1 - t * 0.62);
    const nx = (-dy / length) * half;
    const ny = (dx / length) * half;
    left.push(`${(x + nx).toFixed(1)} ${(y + ny).toFixed(1)}`);
    right.unshift(`${(x - nx).toFixed(1)} ${(y - ny).toFixed(1)}`);
  }
  return `M${left.join(" L")} L${right.join(" L")} Z`;
}

function Leaf({
  id,
  x,
  y,
  side,
  scale,
  angle,
  delay,
  flutter,
}: {
  id: string;
  x: number;
  y: number;
  side: 1 | -1;
  scale: number;
  angle: number;
  delay: number;
  flutter: boolean;
}) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${side} 1) rotate(${angle}) scale(${scale.toFixed(2)})`}>
      <g
        className={flutter ? "animate-leaf-flutter" : undefined}
        style={{ transformBox: "fill-box", transformOrigin: "0% 60%", animationDelay: `${delay}s` }}
      >
        <path d={LEAF} fill={`url(#${id}-leaf)`} />
        <path d={LEAF_VEIN} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Bud({ id, x, y, sway }: { id: string; x: number; y: number; sway: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={sway ? "animate-flower-bob" : undefined} style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}>
        <path d="M0 3 C -9 -6, -10 -26, -2 -44 Q 0 -48 2 -44 C 10 -26, 9 -6, 0 3 Z" fill={`url(#${id}-bud)`} />
        <path d="M0 2 C -2 -14, -1 -30, 0 -44" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.2" />
        <path d="M-4 -2 C -7 -14, -6 -28, -2 -40" fill="none" stroke="#9cc49a" strokeOpacity="0.6" strokeWidth="1" />
      </g>
    </g>
  );
}

/** Lirio abierto en tres cuartos: pétalos de atrás más oscuros, de adelante con borde claro, pecas y estambres curvos. */
function Flower({
  id,
  x,
  y,
  size,
  turn,
  droop,
  delay,
  sway,
}: {
  id: string;
  x: number;
  y: number;
  size: number;
  turn: number;
  droop: number;
  delay: number;
  sway: boolean;
}) {
  const back = [30, 150, 270];
  const front = [-30, 90, 210];
  const petal = (angle: number, fill: string, length: number, index: number) => (
    <g key={`${fill}-${angle}`} transform={`rotate(${angle}) scale(${(length / 46).toFixed(2)})`}>
      {/* Pétalo con la punta curvada hacia atrás. */}
      <path
        d={`M0 0 C 11 -8, 15 -26, 9 -40 C 7 -45, 2 -48, ${index % 2 ? -3 : 4} -46 C -2 -44, -11 -30, -10 -16 C -9 -8, -5 -3, 0 0 Z`}
        fill={fill}
      />
      <path d="M0 -3 C 2 -16, 3 -28, 2 -40" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="-3" cy="-13" r="1" fill="#9e1b4b" opacity="0.75" />
      <circle cx="4" cy="-17" r="1.1" fill="#9e1b4b" opacity="0.7" />
      <circle cx="-1.5" cy="-21" r="0.8" fill="#9e1b4b" opacity="0.6" />
    </g>
  );
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${turn}) scale(${size} ${(size * (droop > 1 ? 0.8 : 0.9)).toFixed(2)})`}>
      <g className={sway ? "animate-flower-bob" : undefined} style={{ transformBox: "fill-box", transformOrigin: "50% 50%", animationDelay: `${delay}s` }}>
        {back.map((angle, index) => petal(angle, `url(#${id}-petal-back)`, 48, index))}
        {front.map((angle, index) => petal(angle, `url(#${id}-petal)`, 44, index + 1))}
        <circle r="5.5" fill="#dcebc6" />
        {[-70, -40, -10, 20, 50, 80].map((angle, index) => (
          <g key={angle} transform={`rotate(${angle})`}>
            <path d={`M0 0 Q ${index % 2 ? 4 : -4} -10 0 -20`} fill="none" stroke="#e3efcf" strokeWidth="1.3" />
            <ellipse cx="0" cy="-21" rx="1.6" ry="3.6" fill="#a8502a" />
          </g>
        ))}
        <path d="M0 0 Q 3 -12 1 -24" fill="none" stroke="#cfe3b4" strokeWidth="1.8" />
        <circle cx="1" cy="-25" r="2.2" fill="#d6e8c0" />
      </g>
    </g>
  );
}

/** Regadera que aparece, se inclina, deja caer gotas y se va. */
function WateringCan() {
  return (
    <g>
      <g transform="translate(176 88)">
        <g className="animate-can-pour" style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}>
          <path d="M-14 -10 H14 Q18 -10 18 -6 V12 Q18 16 14 16 H-14 Q-18 16 -18 12 V-6 Q-18 -10 -14 -10 Z" fill="#9fc6e4" />
          <path d="M-18 -2 L-38 -16 L-40 -12 L-20 4 Z" fill="#8ab8db" />
          <ellipse cx="-40" cy="-14" rx="3" ry="5" fill="#7aa9cf" transform="rotate(-35 -40 -14)" />
          <path d="M-6 -10 Q 0 -24 10 -10" fill="none" stroke="#8ab8db" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M-12 -4 H8" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
      <g fill="#8ec5e8">
        {[132, 138, 126, 142, 129, 136].map((dropX, index) => (
          // La animación usa transform: va en un elemento sin transform propio.
          <g key={index} transform={`translate(${dropX} 112)`}>
            <path d="M0 -6 C 3.5 -1, 4.5 2, 0 5 C -4.5 2, -3.5 -1, 0 -6 Z" className="animate-water-drop" style={{ animationDelay: `${250 + index * 110}ms` }} />
          </g>
        ))}
      </g>
    </g>
  );
}
