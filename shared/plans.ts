import type { PlanStatusName, PlanTypeName } from "./api";

/** Nombre y emoji de cada tipo de plan (lo usan la interfaz y "Próximo momento"). */
export const PLAN_TYPE_INFO: Record<PlanTypeName, { label: string; emoji: string }> = {
  date: { label: "Cita", emoji: "💑" },
  restaurant: { label: "Restaurante", emoji: "🍽️" },
  trip: { label: "Viaje", emoji: "✈️" },
  activity: { label: "Actividad", emoji: "🎳" },
  movie: { label: "Película", emoji: "🎬" },
  goal: { label: "Meta", emoji: "🎯" },
  place_to_visit: { label: "Lugar por conocer", emoji: "📍" },
  other: { label: "Otro", emoji: "✨" },
};

export const PLAN_STATUS_LABELS: Record<PlanStatusName, string> = {
  pending: "Pendiente",
  done: "Realizado",
  cancelled: "Cancelado",
};
