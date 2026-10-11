import type { ImportantDateTypeName } from "./api";

export const IMPORTANT_DATE_TYPE_INFO: Record<ImportantDateTypeName, { label: string; emoji: string; recursYearly: boolean }> = {
  anniversary: { label: "Aniversario", emoji: "💞", recursYearly: true },
  birthday: { label: "Cumpleaños", emoji: "🎂", recursYearly: true },
  first_time: { label: "Primera vez", emoji: "✨", recursYearly: true },
  trip: { label: "Viaje", emoji: "✈️", recursYearly: false },
  custom: { label: "Otra fecha", emoji: "📅", recursYearly: false },
};
