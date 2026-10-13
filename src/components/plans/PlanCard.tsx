import { Link } from "react-router";
import { ArrowRight, CalendarDays, Images, MapPin, Wallet } from "lucide-react";
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
  const soon = plan.status === "pending" && days !== null && days >= 0 && days <= 7;

  return (
    <Link to={`/planes/${plan.id}`} className={`block rounded-card border p-5 transition active:scale-[0.99] ${soon ? "border-transparent bg-blush-100" : "border-blush-200 bg-paper"}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="rounded-lg bg-blush-50 px-2.5 py-1 text-xs font-medium text-blush-700">{info.label}</span>
      {plan.cover ? (
        <MemoryPhoto photo={plan.cover} className="h-12 w-12 shrink-0 rounded-xl" />
      ) : (
        <IconTile emoji={info.emoji} size="sm" tone="blush" muted={plan.status === "cancelled"} />
      )}
      </div>
      <div className="min-w-0">
        <h3 className={`text-lg ${plan.status === "cancelled" ? "text-ink-soft line-through" : ""}`}>{plan.title}</h3>
        <div className="mt-2 flex flex-col gap-2 text-sm text-ink-soft">
          {plan.plannedFor ? (
            <span className={`flex items-center gap-2 ${overdue || soon ? "text-blush-700" : ""}`}>
              <CalendarDays size={14} className="shrink-0" aria-hidden />
              <span>
              {plan.status === "pending" && days !== null ? `${formatRelativeDays(days)} · ` : ""}
              {formatLongDate(plan.plannedFor)}
              </span>
            </span>
          ) : (
            plan.status === "pending" && <span>Sin fecha</span>
          )}
          {plan.placeName && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin size={14} className="shrink-0" aria-hidden /> <span className="break-words">{plan.placeName}</span>
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
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-blush-200 pt-3 text-xs text-ink-soft">
        <span>{plan.status === "done" ? "Hecho juntos" : plan.status === "cancelled" ? "Cancelado" : "Un nuevo momento por vivir"}</span>
        <ArrowRight size={16} className="shrink-0 text-blush-500" aria-label="Ver plan" />
      </div>
    </Link>
  );
}
