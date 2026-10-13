import type { PlantResponse } from "@shared/api";

// Dibujo del lirio según su etapa y su ánimo. Todo en SVG, sin imágenes.

const STEM_HEIGHT = [0, 26, 58, 96, 124, 134, 138];
const LEAF_PAIRS = [0, 0, 1, 2, 3, 3, 3];
const BASE = { x: 120, y: 206 };
const CLUSTER: [number, number][] = [[-34, 26], [36, 30], [-30, 58], [32, 62], [-38, 88], [38, 92]];

const LEAF = "M0 0 C 14 -7, 36 -8, 52 -3 C 36 2, 14 4, 0 0 Z";

interface Props {
  plant: Pick<PlantResponse, "stage" | "flowers" | "mood">;
  /** Muestra gotas cayendo (al regarla). */
  watering?: boolean;
}

export function PlantArt({ plant, watering = false }: Props) {
  const stage = plant.stage.index;
  const thirst = plant.mood === "happy" ? 0 : plant.mood === "thirsty" ? 1 : 2;
  const height = STEM_HEIGHT[stage] ?? 0;
  // Con sed la punta se dobla hacia un lado y las hojas caen.
  const bend = thirst * 16;
  const tip = { x: BASE.x + bend, y: BASE.y - height + thirst * 10 };
  const control = { x: BASE.x - 4, y: BASE.y - height * 0.6 };
  const leafAngle = [-34, 0, 26][thirst]!;
  const green = ["#6faa86", "#8fb08c", "#a9ad84"][thirst]!;
  const stemPath = `M${BASE.x} ${BASE.y} Q ${control.x} ${control.y} ${tip.x} ${tip.y}`;

  const pointAt = (t: number) => ({
    x: (1 - t) ** 2 * BASE.x + 2 * (1 - t) * t * control.x + t ** 2 * tip.x,
    y: (1 - t) ** 2 * BASE.y + 2 * (1 - t) * t * control.y + t ** 2 * tip.y,
  });

  const leaves: { x: number; y: number; side: 1 | -1; scale: number }[] = [];
  const pairs = LEAF_PAIRS[stage] ?? 0;
  for (let i = 0; i < pairs; i++) {
    const t = 0.32 + (i / Math.max(1, pairs)) * 0.55;
    const point = pointAt(t);
    const scale = 1 - i * 0.12;
    leaves.push({ ...point, side: -1, scale }, { ...pointAt(t + 0.08), side: 1, scale });
  }

  // Flores extra: arracimadas cerca de la punta, como en una vara de lirios.
  const extraFlowers = Math.max(0, plant.flowers - 1);
  const flowerSpots = CLUSTER.slice(0, extraFlowers).map(([dx, dy]) => ({ x: tip.x + dx, y: tip.y + dy }));

  return (
    <svg viewBox="0 0 240 280" role="img" aria-label={`${plant.stage.name}${thirst > 0 ? ", con sed" : ""}`} className="mx-auto h-auto w-full max-w-64">
      <ellipse cx="120" cy="268" rx="70" ry="6" fill="#382931" opacity="0.06" />
      <g className={thirst === 0 && stage > 0 ? "origin-[120px_206px] animate-plant-sway" : undefined}>
        {stage > 0 && <path d={stemPath} fill="none" stroke={green} strokeWidth={stage > 2 ? 5 : 4} strokeLinecap="round" />}
        {stage === 1 && (
          <g fill={green}>
            <path d={LEAF} transform={`translate(${tip.x} ${tip.y}) rotate(${leafAngle - 40}) scale(0.5)`} />
            <path d={LEAF} transform={`translate(${tip.x} ${tip.y}) scale(-1 1) rotate(${leafAngle - 40}) scale(0.5)`} />
          </g>
        )}
        {leaves.map((leaf, index) => (
          <path
            key={index}
            d={LEAF}
            fill={green}
            transform={`translate(${leaf.x} ${leaf.y}) scale(${leaf.side} 1) rotate(${leafAngle}) scale(${leaf.scale})`}
          />
        ))}
        {stage >= 2 && stage < 4 && (
          <g fill={green}>
            <path d={LEAF} transform={`translate(${tip.x} ${tip.y}) rotate(${leafAngle - 48}) scale(0.55)`} />
            <path d={LEAF} transform={`translate(${tip.x} ${tip.y}) scale(-1 1) rotate(${leafAngle - 48}) scale(0.55)`} />
          </g>
        )}
        {stage === 4 && <Bud x={tip.x} y={tip.y} />}
        {stage >= 5 && <Flower x={tip.x} y={tip.y} size={1} droop={thirst} />}
        {flowerSpots.map((spot, index) => (
          <path key={`pedicel-${index}`} d={`M${tip.x - bend * 0.2} ${spot.y + 14} Q ${(tip.x + spot.x) / 2} ${spot.y + 10} ${spot.x} ${spot.y}`} fill="none" stroke={green} strokeWidth="2.5" strokeLinecap="round" />
        ))}
        {flowerSpots.map((spot, index) => (
          <Flower key={index} x={spot.x} y={spot.y} size={0.55} droop={thirst} />
        ))}
      </g>
      {/* Maceta */}
      <path d="M66 206 H174 L162 262 Q160 268 154 268 H86 Q80 268 78 262 Z" fill="#e8a3b6" />
      <rect x="60" y="196" width="120" height="18" rx="6" fill="#d98aa1" />
      <ellipse cx="120" cy="203" rx="52" ry="5" fill="#7a5340" />
      {stage === 0 && (
        <g>
          <path d="M104 204 Q120 192 136 204 Z" fill="#8a5f48" />
          <path d="M120 186 C 126 192, 130 196, 129 201 C 127 205, 113 205, 111 201 C 110 196, 114 192, 120 186 Z" fill="#ead9b8" stroke="#c9ad83" strokeWidth="1.5" />
        </g>
      )}
      <path d="M96 236 q8 -7 16 0 q8 7 16 0 q8 -7 16 0" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
      {watering && (
        <g fill="#8ec5e8">
          {[96, 112, 128, 144, 104, 136].map((x, index) => (
            <path
              key={index}
              d="M0 -7 C 4 -1, 5 2, 0 5 C -5 2, -4 -1, 0 -7 Z"
              transform={`translate(${x} 110)`}
              className="animate-water-drop"
              style={{ animationDelay: `${index * 90}ms` }}
            />
          ))}
        </g>
      )}
    </svg>
  );
}

function Bud({ x, y }: { x: number; y: number }) {
  // Botón de lirio: largo y cerrado, con un rubor rosado en la punta.
  return (
    <g transform={`translate(${x} ${y}) rotate(-8)`}>
      <path d="M0 2 C -8 -6, -8 -26, 0 -40 C 8 -26, 8 -6, 0 2 Z" fill="#cfe3c4" />
      <path d="M0 -14 C -5 -20, -5 -30, 0 -40 C 5 -30, 5 -20, 0 -14 Z" fill="#f2a7bf" />
      <path d="M0 2 V -38" stroke="#9cc49a" strokeWidth="1.2" />
    </g>
  );
}

/** Lirio abierto visto de frente: seis pétalos en estrella, con su raya, sus pecas y los estambres. */
function Flower({ x, y, size, droop }: { x: number; y: number; size: number; droop: number }) {
  const outer = [0, 120, 240];
  const inner = [60, 180, 300];
  const petal = droop > 1 ? "#ebbfcc" : "#f4a3be";
  const stripe = droop > 1 ? "#d98fa6" : "#d9577f";
  return (
    <g transform={`translate(${x} ${y}) rotate(${droop * 25}) scale(${size})`}>
      {[...outer, ...inner].map((angle, index) => (
        <g key={angle} transform={`rotate(${angle}) scale(${index < 3 ? 1 : 0.88})`}>
          <path d="M0 0 C 9 -9, 10 -27, 0 -40 C -10 -27, -9 -9, 0 0 Z" fill={petal} stroke="#fff" strokeOpacity="0.7" strokeWidth="1.5" />
          <path d="M0 -4 Q 1 -20 0 -32" fill="none" stroke={stripe} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="-3.5" cy="-12" r="1.1" fill="#b23c63" />
          <circle cx="3.5" cy="-15" r="1.1" fill="#b23c63" />
          <circle cx="-2.5" cy="-20" r="0.9" fill="#b23c63" />
        </g>
      ))}
      <circle r="5" fill="#e9f2d8" />
      {[20, 80, 140, 200, 260, 320].map((angle) => (
        <g key={angle} transform={`rotate(${angle})`}>
          <path d="M0 0 L0 -16" stroke="#cfe3c4" strokeWidth="1.4" />
          <ellipse cx="0" cy="-17" rx="1.8" ry="3.4" fill="#b5562f" />
        </g>
      ))}
    </g>
  );
}
