import type { LetterSummary, LetterTypeName } from "@shared/api";
import { utcToZoned } from "@shared/dates";
import { formatLongDate, formatShortDateIn } from "@/utils/format";
import type { EnvelopeState } from "./Envelope";

export const LETTER_TYPE_LABELS: Record<LetterTypeName, string> = {
  normal: "Carta",
  open_when: "Ábreme cuando…",
  scheduled: "Programada",
  surprise: "Sorpresa",
};

/** Sobre y frase de estado de una carta, según quién la mira. */
export function letterStatus(letter: LetterSummary, timezone: string): { envelope: EnvelopeState; label: string } {
  const unlockDate = letter.unlockAt ? formatShortDateIn(letter.unlockAt, timezone) : "";
  const openedDate = letter.openedAt ? formatLongDate(utcToZoned(letter.openedAt, timezone).date) : "";

  if (letter.isMine) {
    if (letter.isLocked) {
      return {
        envelope: "locked",
        label: letter.type === "surprise" ? `Sorpresa: aparecerá el ${unlockDate}` : `Se podrá abrir el ${unlockDate}`,
      };
    }
    if (letter.openedAt) return { envelope: "opened", label: `La abrió el ${openedDate}` };
    return { envelope: letter.type === "open_when" ? "open-when" : "sealed", label: "Todavía sin abrir" };
  }

  if (letter.isLocked) return { envelope: "locked", label: `Disponible el ${unlockDate} ♡` };
  if (letter.openedAt) return { envelope: "opened", label: `Abierta el ${openedDate}` };
  if (letter.type === "open_when") return { envelope: "open-when", label: "Ábrela cuando lo necesites" };
  return { envelope: "sealed", label: "Lista para abrir" };
}
