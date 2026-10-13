import { Link } from "react-router";
import { ArrowRight, Lock, Mail, MailOpen, Send } from "lucide-react";
import type { LetterSummary } from "@shared/api";
import { LETTER_TYPE_LABELS, letterStatus } from "./letterStatus";

interface Props {
  letter: LetterSummary;
  timezone: string;
}

export function LetterListItem({ letter, timezone }: Props) {
  const status = letterStatus(letter, timezone);
  const person = letter.isMine ? `Para ${letter.recipient.displayName}` : `De ${letter.author.displayName}`;
  const unread = !letter.isMine && !letter.isLocked && !letter.openedAt;
  const Icon = letter.isLocked ? Lock : letter.isMine ? Send : letter.openedAt ? MailOpen : Mail;

  return (
    <Link
      to={`/cartas/${letter.id}`}
      className={`block rounded-card border p-5 transition active:scale-[0.99] ${unread ? "border-transparent bg-blush-100" : "border-blush-200 bg-paper"}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <Icon size={23} strokeWidth={1.6} className="shrink-0 text-blush-500" aria-hidden />
        <span className="text-xs text-ink-soft">{LETTER_TYPE_LABELS[letter.type]}</span>
      </div>
      <h3 className="text-xl leading-snug">{letter.title}</h3>
      <p className="mt-2 text-xs text-ink-soft">{person}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">{status.label}</p>
        {unread ? <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-paper px-3 py-2 text-xs font-medium text-blush-700" aria-label="Sin abrir">Abrir <ArrowRight size={14} aria-hidden /></span> : <ArrowRight size={16} className="shrink-0 text-ink-soft" aria-hidden />}
      </div>
    </Link>
  );
}
