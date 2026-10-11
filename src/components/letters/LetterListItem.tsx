import { Link } from "react-router";
import type { LetterSummary } from "@shared/api";
import { Envelope } from "./Envelope";
import { LETTER_TYPE_LABELS, letterStatus } from "./letterStatus";

interface Props {
  letter: LetterSummary;
  timezone: string;
}

export function LetterListItem({ letter, timezone }: Props) {
  const status = letterStatus(letter, timezone);
  const person = letter.isMine ? `Para ${letter.recipient.displayName}` : `De ${letter.author.displayName}`;
  const unread = !letter.isMine && !letter.isLocked && !letter.openedAt;

  return (
    <Link
      to={`/cartas/${letter.id}`}
      className="flex items-center gap-4 rounded-card bg-paper p-4 shadow-soft transition active:scale-[0.99]"
    >
      <Envelope state={status.envelope} className="h-14 w-20 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
          {LETTER_TYPE_LABELS[letter.type]} · {person}
        </p>
        <p className={`truncate font-display text-lg ${unread ? "text-blush-700" : ""}`}>{letter.title}</p>
        <p className={`text-sm ${unread ? "font-semibold text-blush-500" : "text-ink-soft"}`}>{status.label}</p>
      </div>
      {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blush-500" aria-label="Sin abrir" />}
    </Link>
  );
}
