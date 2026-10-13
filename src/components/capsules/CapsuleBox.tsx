import { Gift, LockKeyhole, PackageOpen } from "lucide-react";

export type CapsuleState = "locked" | "ready" | "opened";

interface Props {
  state: CapsuleState;
  className?: string;
}

/** La cápsula conserva un estado visual distinto antes y después de abrirse. */
export function CapsuleBox({ state, className = "" }: Props) {
  const Icon = state === "locked" ? LockKeyhole : state === "opened" ? PackageOpen : Gift;
  return (
    <div className={`flex items-center justify-center rounded-card ${state === "locked" ? "bg-blush-50 text-ink-soft" : "bg-blush-100 text-blush-500"} ${className}`} aria-hidden>
      <Icon className="h-1/2 w-1/2" strokeWidth={1.2} />
    </div>
  );
}
