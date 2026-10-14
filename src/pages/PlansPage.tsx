import { Link, useSearchParams } from "react-router";
import { CalendarHeart, Plus } from "lucide-react";
import type { PlanStatusName, PlanSummary, PlanTypeName } from "@shared/api";
import { todayIn } from "@shared/dates";
import { PLAN_TYPE_INFO } from "@shared/plans";
import { useMe } from "@/auth/AuthContext";
import { PlanCard } from "@/components/plans/PlanCard";
import { PendingList } from "@/components/sync/PendingList";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useMarkSeen } from "@/hooks/useMarkSeen";
import { useOutbox } from "@/hooks/useOutbox";
import { plansApi } from "@/services/api/plans";
import { InlineIcon } from "@/components/icons/EmojiIcon";

const TABS: { status: PlanStatusName; label: string; param: string | null }[] = [
  { status: "pending", label: "Por hacer", param: null },
  { status: "done", label: "Hechos", param: "realizados" },
  { status: "cancelled", label: "Cancelados", param: "cancelados" },
];

const chipClass = (active: boolean) =>
  `nl-chip ${
    active ? "border-blush-200 bg-blush-100 text-blush-700" : "border-blush-200 bg-paper text-ink-soft hover:text-ink"
  }`;

export function PlansPage() {
  useMarkSeen("plans");
  const me = useMe();
  const today = todayIn(me.relationship?.timezone ?? "UTC");
  const plans = useAsync(plansApi.list, { cacheKey: "plans" });
  const pending = useOutbox("plan.create");
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.param === params.get("estado")) ?? TABS[0]!;
  const type = params.get("tipo") as PlanTypeName | null;

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [name, value] of Object.entries(changes)) {
      if (value === null) next.delete(name);
      else next.set(name, value);
    }
    setParams(next, { replace: true });
  };

  return (
    <section>
      <header className="mb-4 flex animate-fade-up items-center justify-between gap-3">
        <h1 className="text-4xl tracking-tighter">Planes</h1>
        <Link to="/planes/nuevo" className="nl-action">
          <Plus size={16} aria-hidden /> Nuevo
        </Link>
      </header>
      <p className="mb-5 text-sm text-ink-soft">Siempre hay algo bonito por hacer.</p>

      <div className="nl-tabs mb-4 animate-fade-up [animation-delay:40ms]" role="tablist" aria-label="Estado">
        {TABS.map((t) => (
          <button key={t.status} type="button" role="tab" aria-selected={tab === t} className="nl-tab" onClick={() => update({ estado: t.param })}>
            {t.label}
            {plans.status === "success" && <span className="ml-1 font-normal opacity-70">{plans.data.items.filter((p) => p.status === t.status).length}</span>}
          </button>
        ))}
      </div>

      {tab.status === "pending" && (
        <PendingList type="plan.create" describe={(action) => PLAN_TYPE_INFO[action.payload.input.type].label} />
      )}

      {plans.status === "loading" && (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}
      {plans.status === "error" && (
        <Card className="text-center">
          <p className="text-ink-soft">{plans.message}</p>
          <Button variant="secondary" className="mt-4" onClick={plans.reload}>
            Reintentar
          </Button>
        </Card>
      )}
      {plans.status === "success" && (
        <PlanList items={plans.data.items} status={tab.status} type={type} today={today} hasPending={pending.length > 0} onType={(value) => update({ tipo: value })} />
      )}
    </section>
  );
}

interface ListProps {
  items: PlanSummary[];
  status: PlanStatusName;
  type: PlanTypeName | null;
  today: string;
  /** Hay planes creados sin conexión esperando a sincronizar (no mostrar "vacío"). */
  hasPending: boolean;
  onType: (type: PlanTypeName | null) => void;
}

function PlanList({ items, status, type, today, hasPending, onType }: ListProps) {
  const inTab = items.filter((plan) => plan.status === status);
  const types = [...new Set(inTab.map((plan) => plan.type))];
  const visible = type ? inTab.filter((plan) => plan.type === type) : inTab;

  return (
    <>
      {types.length > 1 && (
        <div className="-mx-5 mb-4 flex animate-fade-up gap-2 overflow-x-auto px-5 pb-1 [animation-delay:80ms] [scrollbar-width:none]">
          <button type="button" className={chipClass(!type)} onClick={() => onType(null)}>
            Todos
          </button>
          {types.map((value) => (
            <button key={value} type="button" className={chipClass(type === value)} onClick={() => onType(type === value ? null : value)}>
              <InlineIcon emoji={PLAN_TYPE_INFO[value].emoji} /> {PLAN_TYPE_INFO[value].label}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 && hasPending && status === "pending" && !type ? null : visible.length === 0 ? (
        <Card className="animate-fade-up px-6 py-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lavender-100 text-lavender-500">
            <CalendarHeart size={26} strokeWidth={1.75} aria-hidden />
          </span>
          <p className="mt-4 font-display text-xl">
            {status === "pending" ? "¿Qué quieren hacer juntos?" : status === "done" ? "Todavía nada por aquí" : "Ningún plan cancelado"}
          </p>
          <p className="mx-auto mt-2 max-w-xs text-ink-soft">
            {status === "pending"
              ? "Una cita, un viaje, una película pendiente o un lugar por conocer."
              : status === "done"
                ? "Cuando marquen un plan como realizado, aparecerá aquí."
                : "Mejor así ♡"}
          </p>
          {status === "pending" && (
            <Link to="/planes/nuevo" className="mt-5 inline-flex items-center gap-2 rounded-full bg-pastel px-6 py-3 font-bold text-ink">
              <Plus size={18} aria-hidden /> Crear plan
            </Link>
          )}
        </Card>
      ) : (
        <ul className="space-y-3">
          {visible.map((plan) => (
            <li key={plan.id} className="animate-fade-up">
              <PlanCard plan={plan} today={today} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
