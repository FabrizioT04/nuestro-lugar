import { Link } from "react-router";
import { Images, MapPin, Wallet } from "lucide-react";
import type { PlanSummary } from "@shared/api";
import { PLAN_TYPE_INFO } from "@shared/plans";
import { daysBetween } from "@shared/dates";
import { MemoryPhoto } from "@/components/memories/MemoryPhoto";
import { formatLongDate, formatMoney, formatRelativeDays } from "@/utils/format";
import { IconTile } from "@/components/icons/EmojiIcon";

interface Props {
  plan: PlanSummary;
  today: string;
}

export function PlanCard({ plan, today }: Props) {
  const info = PLAN_TYPE_INFO[plan.type];
  const days = plan.plannedFor ? daysBetween(today, plan.plannedFor) : null;
  const overdue = plan.status === "pending" && days !== null && days < 0;

  return (
    <Link to={`/planes/${plan.id}`} className="flex items-center gap-4 rounded-card bg-paper p-4 shadow-soft transition active:scale-[0.99]">
      {plan.cover ? (
        <MemoryPhoto photo={plan.cover} className="h-16 w-16 shrink-0 rounded-2xl" />
      ) : (
        <IconTile emoji={info.emoji} size="xl" muted={plan.status === "cancelled"} />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{info.label}</p>
        <p className={`truncate font-display text-lg ${plan.status === "cancelled" ? "text-ink-soft line-through" : ""}`}>{plan.title}</p>
        <p className="flex flex-wrap items-center gap-x-3 text-sm text-ink-soft">
          {plan.plannedFor ? (
            <span className={overdue ? "font-semibold text-blush-500" : plan.status === "pending" && days !== null && days <= 7 ? "font-semibold text-lavender-500" : ""}>
              {plan.status === "pending" && days !== null ? `${formatRelativeDays(days)} · ` : ""}
              {formatLongDate(plan.plannedFor)}
            </span>
          ) : (
            plan.status === "pending" && <span>Sin fecha</span>
          )}
          {plan.placeName && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin size={13} aria-hidden /> <span className="truncate">{plan.placeName}</span>
            </span>
          )}
          {plan.budget && (
            <span className="flex items-center gap-1">
              <Wallet size={13} aria-hidden /> {formatMoney(plan.budget.amountCents, plan.budget.currency)}
            </span>
          )}
          {plan.photoCount > 0 && (
            <span className="flex items-center gap-1">
              <Images size={13} aria-hidden /> {plan.photoCount}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}
