import { LockKeyhole, Mail, MailOpen } from "lucide-react";

export type EnvelopeState = "sealed" | "open-when" | "locked" | "opened";

interface Props {
  state: EnvelopeState;
  className?: string;
}

/** Mantiene los estados de la carta con una ilustración de línea sencilla. */
export function Envelope({ state, className = "" }: Props) {
  const Icon = state === "locked" ? LockKeyhole : state === "opened" ? MailOpen : Mail;
  return (
    <div className={`flex items-center justify-center rounded-card ${state === "locked" ? "bg-blush-50 text-ink-soft" : "bg-blush-100 text-blush-500"} ${className}`} aria-hidden>
      <Icon className="h-1/2 w-1/2" strokeWidth={1.2} />
    </div>
  );
}
