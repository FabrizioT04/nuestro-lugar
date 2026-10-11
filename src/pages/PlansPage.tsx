import { Link, useSearchParams } from "react-router";
import { CalendarHeart, Plus } from "lucide-react";
import type { PlanStatusName, PlanSummary, PlanTypeName } from "@shared/api";
import { todayIn } from "@shared/dates";
import { PLAN_TYPE_INFO } from "@shared/plans";
import { useMe } from "@/auth/AuthContext";
import { PlanCard } from "@/components/plans/PlanCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { plansApi } from "@/services/api/plans";

const TABS: { status: PlanStatusName; label: string; param: string | null }[] = [
  { status: "pending", label: "Pendientes", param: null },
  { status: "done", label: "Realizados", param: "realizados" },
  { status: "cancelled", label: "Cancelados", param: "cancelados" },
];

const tabClass = (active: boolean) =>
  `flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${active ? "bg-blush-300 text-ink" : "text-ink-soft hover:text-ink"}`;

const chipClass = (active: boolean) =>
  `flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
    active ? "bg-lavender-300 text-ink" : "bg-paper text-ink-soft shadow-soft hover:text-ink"
  }`;

export function PlansPage() {
  const me = useMe();
  const today = todayIn(me.relationship?.timezone ?? "UTC");
  const plans = useAsync(plansApi.list);
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
        <h1 className="text-3xl">Planes</h1>
        <Link to="/planes/nuevo" className="inline-flex items-center gap-2 rounded-full bg-blush-300 px-4 py-2.5 text-sm font-semibold text-ink shadow-soft transition hover:bg-blush-200 active:scale-95">
          <Plus size={16} aria-hidden /> Nuevo
        </Link>
      </header>

      <div className="mb-3 flex animate-fade-up rounded-full bg-paper p-1 shadow-soft [animation-delay:40ms]" role="tablist" aria-label="Estado">
        {TABS.map((t) => (
          <button key={t.status} type="button" role="tab" aria-selected={tab === t} className={tabClass(tab === t)} onClick={() => update({ estado: t.param })}>
            {t.label}
            {plans.status === "success" && <span className="ml-1 font-normal opacity-70">{plans.data.items.filter((p) => p.status === t.status).length}</span>}
          </button>
        ))}
      </div>

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
        <PlanList items={plans.data.items} status={tab.status} type={type} today={today} onType={(value) => update({ tipo: value })} />
      )}
    </section>
  );
}

interface ListProps {
  items: PlanSummary[];
  status: PlanStatusName;
  type: PlanTypeName | null;
  today: string;
  onType: (type: PlanTypeName | null) => void;
}

function PlanList({ items, status, type, today, onType }: ListProps) {
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
              <span aria-hidden>{PLAN_TYPE_INFO[value].emoji}</span> {PLAN_TYPE_INFO[value].label}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
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
            <Link to="/planes/nuevo" className="mt-5 inline-flex items-center gap-2 rounded-full bg-blush-300 px-6 py-3 font-semibold text-ink">
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
