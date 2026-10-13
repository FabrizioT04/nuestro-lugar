// La plantita de los dos (un lirio): crece un poquito por cada día que alguien la riega,
// a un ritmo parecido al de una planta de verdad (unos dos meses hasta florecer del todo).
// Solo funciones puras: las usan el Worker y React.

export interface PlantStage {
  /** 0 = semilla … 6 = en flor. */
  index: number;
  name: string;
  /** Días de cuidado desde los que empieza esta etapa. */
  from: number;
}

export const PLANT_STAGES: PlantStage[] = [
  { index: 0, name: "Bulbo", from: 0 },
  { index: 1, name: "Brote", from: 1 },
  { index: 2, name: "Plantita", from: 4 },
  { index: 3, name: "Creciendo", from: 10 },
  { index: 4, name: "Con botón", from: 21 },
  { index: 5, name: "Primer lirio", from: 35 },
  { index: 6, name: "En flor", from: 50 },
];

/** Ya en flor, le sale otra flor cada tantos días de cuidado, hasta MAX_FLOWERS. */
export const DAYS_PER_EXTRA_FLOWER = 10;
export const MAX_FLOWERS = 7;

export function plantStage(careDays: number): PlantStage {
  let stage = PLANT_STAGES[0]!;
  for (const candidate of PLANT_STAGES) if (careDays >= candidate.from) stage = candidate;
  return stage;
}

/** Días de cuidado que faltan para la siguiente etapa; null si ya está en flor. */
export function daysToNextStage(careDays: number): number | null {
  const next = PLANT_STAGES.find((stage) => stage.from > careDays);
  return next ? next.from - careDays : null;
}

export function flowerCount(careDays: number): number {
  const bloom = PLANT_STAGES[5]!.from;
  if (careDays < bloom) return 0;
  return Math.min(MAX_FLOWERS, 1 + Math.floor((careDays - bloom) / DAYS_PER_EXTRA_FLOWER));
}

export type PlantMood = "happy" | "thirsty" | "very_thirsty";

/** Nunca se muere: si nadie la riega se pone triste, y se alegra en cuanto la riegan. */
export function plantMood(daysSinceWater: number | null): PlantMood {
  if (daysSinceWater === null || daysSinceWater <= 1) return "happy";
  return daysSinceWater === 2 ? "thirsty" : "very_thirsty";
}
