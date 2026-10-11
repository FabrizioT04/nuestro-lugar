import type { CapsuleSummary } from "@shared/api";
import { daysBetween, todayIn, utcToZoned } from "@shared/dates";
import { formatCountdown, formatLongDate, formatShortDateIn } from "@/utils/format";
import type { CapsuleState } from "./CapsuleBox";

/** "Para Ana", "Para los dos" o "De Fabrizio", según quién la mira. */
export function capsulePeople(capsule: CapsuleSummary, partnerName: string): string {
  if (capsule.recipient === "both") return capsule.isMine ? "Para los dos" : `De ${capsule.author.displayName} · para los dos`;
  return capsule.isMine ? `Para ${partnerName}` : `De ${capsule.author.displayName}`;
}

/** Ilustración, frase de estado y cuenta atrás de una cápsula. */
export function capsuleStatus(capsule: CapsuleSummary, timezone: string): { box: CapsuleState; label: string; countdown: string | null } {
  if (capsule.isLocked) {
    const daysUntil = daysBetween(todayIn(timezone), utcToZoned(capsule.unlockAt, timezone).date);
    return {
      box: "locked",
      label: `Disponible el ${formatShortDateIn(capsule.unlockAt, timezone)} ❤`,
      countdown: daysUntil > 0 ? formatCountdown(daysUntil) : "Hoy",
    };
  }
  if (capsule.openedAt) {
    const openedOn = formatLongDate(utcToZoned(capsule.openedAt, timezone).date);
    return { box: "opened", label: capsule.isMine ? `Se abrió el ${openedOn}` : `Abierta el ${openedOn}`, countdown: null };
  }
  return { box: "ready", label: capsule.isMine ? "Ya llegó su fecha, todavía sin abrir" : "¡Ya se puede abrir!", countdown: null };
}
