import type { PlantResponse } from "@shared/api";

// Dibujo de la plantita según su etapa y su ánimo. Todo en SVG, sin imágenes.

const STEM_HEIGHT = [0, 26, 58, 96, 124, 134, 138];
const LEAF_PAIRS = [0, 0, 1, 2, 3, 3, 3];
const BASE = { x: 120, y: 206 };

const LEAF = "M0 0 C 9 -13, 30 -14, 40 0 C 30 9, 9 9, 0 0 Z";

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
  const leafAngle = [-28, 4, 28][thirst]!;
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

  // Flores extra: en la punta de algunas hojas, de abajo hacia arriba.
  const extraFlowers = Math.max(0, plant.flowers - 1);
  const flowerSpots = leaves.slice(0, extraFlowers).map((leaf) => ({ x: leaf.x + leaf.side * 34 * leaf.scale, y: leaf.y - 14 * leaf.scale }));

  return (
    <svg viewBox="0 0 240 280" role="img" aria-label={`${plant.stage.name}${thirst > 0 ? ", con sed" : ""}`} className="mx-auto h-auto w-full max-w-64">
      <ellipse cx="120" cy="268" rx="70" ry="6" fill="#382931" opacity="0.06" />
      <g className={thirst === 0 && stage > 0 ? "origin-[120px_206px] animate-plant-sway" : undefined}>
        {stage > 0 && <path d={stemPath} fill="none" stroke={green} strokeWidth={stage > 2 ? 5 : 4} strokeLinecap="round" />}
        {stage === 1 && (
          <g fill={green}>
            <path d={LEAF} transform={`translate(${tip.x} ${tip.y}) rotate(${leafAngle - 10}) scale(0.45)`} />
            <path d={LEAF} transform={`translate(${tip.x} ${tip.y}) scale(-1 1) rotate(${leafAngle - 10}) scale(0.45)`} />
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
            <path d={LEAF} transform={`translate(${tip.x} ${tip.y}) rotate(${leafAngle - 40}) scale(0.5)`} />
            <path d={LEAF} transform={`translate(${tip.x} ${tip.y}) scale(-1 1) rotate(${leafAngle - 40}) scale(0.5)`} />
          </g>
        )}
        {stage === 4 && <Bud x={tip.x} y={tip.y} />}
        {stage >= 5 && <Flower x={tip.x} y={tip.y} size={1} droop={thirst} />}
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
          <ellipse cx="122" cy="197" rx="6" ry="4" fill="#c9965f" transform="rotate(-20 122 197)" />
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
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 4 C -9 -2, -7 -16, 0 -22 C 7 -16, 9 -2, 0 4 Z" fill="#f2a7bf" />
      <path d="M0 4 C -6 0, -8 -6, -6 -10 M0 4 C 6 0, 8 -6, 6 -10" fill="none" stroke="#6faa86" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Flower({ x, y, size, droop }: { x: number; y: number; size: number; droop: number }) {
  const petals = [0, 72, 144, 216, 288];
  return (
    <g transform={`translate(${x} ${y}) rotate(${droop * 25}) scale(${size})`}>
      {petals.map((angle) => (
        <ellipse key={angle} cx="0" cy="-13" rx="9" ry="13" fill={droop > 1 ? "#e9b8c6" : "#f4a6c0"} transform={`rotate(${angle})`} />
      ))}
      <circle r="7" fill="#ffd77a" />
    </g>
  );
}
