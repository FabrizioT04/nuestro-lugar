import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, BookHeart, CalendarDays, Check, ImagePlus, MapPin, Pencil, RotateCcw, Trash2, Wallet, X } from "lucide-react";
import type { PlanDetail, PlanStatusName } from "@shared/api";
import { daysBetween, todayIn, utcToZoned } from "@shared/dates";
import { PLAN_STATUS_LABELS, PLAN_TYPE_INFO } from "@shared/plans";
import { useMe } from "@/auth/AuthContext";
import { MemoryPhoto } from "@/components/memories/MemoryPhoto";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { writeCache } from "@/offline/cache";
import { submitAction } from "@/offline/sync";
import { plansApi } from "@/services/api/plans";
import { formatLongDate, formatMoney, formatRelativeDays } from "@/utils/format";

const STATUS_STYLES: Record<PlanStatusName, string> = {
  pending: "bg-lavender-100 text-lavender-500",
  done: "bg-blush-50 text-blush-700",
  cancelled: "bg-cream text-ink-soft",
};

export function PlanDetailPage() {
  const { id = "" } = useParams();
  const load = useCallback(() => plansApi.get(id), [id]);
  const plan = useAsync(load, { cacheKey: `plan:${id}` });

  return (
    <section>
      <header className="mb-4">
        <Link to="/planes" aria-label="Volver a planes" className="flex h-10 w-10 items-center justify-center rounded-full bg-paper shadow-soft">
          <ArrowLeft size={20} aria-hidden />
        </Link>
      </header>
      {plan.status === "loading" && <Skeleton className="h-96" />}
      {plan.status === "error" && (
        <Card className="text-center">
          <p className="text-ink-soft">{plan.message}</p>
          <Link to="/planes" className="mt-4 inline-block font-semibold text-blush-500">
            Volver a planes
          </Link>
        </Card>
      )}
      {plan.status === "success" && <PlanContent key={`${plan.data.updatedAt}:${plan.data.status}`} initial={plan.data} />}
    </section>
  );
}

function PlanContent({ initial }: { initial: PlanDetail }) {
  const navigate = useNavigate();
  const me = useMe();
  const timezone = me.relationship?.timezone ?? "UTC";
  const today = todayIn(timezone);
  const [plan, setPlan] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const info = PLAN_TYPE_INFO[plan.type];
  const days = plan.plannedFor ? daysBetween(today, plan.plannedFor) : null;

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : failure);
    } finally {
      setBusy(false);
    }
  }

  const changeStatus = (status: PlanStatusName) =>
    run(async () => {
      const result = await submitAction<"plan.status", PlanDetail>("plan.status", { planId: plan.id, status }, `Plan: ${plan.title}`);
      if (result.status === "saved") {
        setPlan(result.result);
        return;
      }
      // Sin conexión: se ve el cambio ya y queda ⏳ pendiente hasta sincronizar.
      const optimistic: PlanDetail = { ...plan, status, completedAt: status === "done" ? new Date().toISOString() : null };
      setPlan(optimistic);
      void writeCache(`plan:${plan.id}`, optimistic);
      setNotice("⏳ Se guardará cuando vuelva la conexión");
    }, "No se pudo cambiar el estado");

  const toMemory = () =>
    run(async () => {
      const { memoryId } = await plansApi.toMemory(plan.id);
      navigate(`/recuerdos/${memoryId}`);
    }, "No se pudo crear el recuerdo");

  const remove = () =>
    run(async () => {
      await plansApi.remove(plan.id);
      navigate("/planes", { replace: true });
    }, "No se pudo borrar el plan");

  return (
    <article className="space-y-4">
      <Card className="animate-fade-up">
        <div className="flex items-start gap-4">
          <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-lavender-100 text-3xl ${plan.status === "cancelled" ? "grayscale" : ""}`} aria-hidden>
            {info.emoji}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{info.label}</p>
            <h1 className="text-2xl leading-tight">{plan.title}</h1>
            <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[plan.status]}`}>
              {PLAN_STATUS_LABELS[plan.status]}
              {plan.status === "done" && plan.completedAt ? ` · ${formatLongDate(utcToZoned(plan.completedAt, timezone).date)}` : ""}
            </span>
          </div>
        </div>

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-ink-soft" aria-hidden />
            <dt className="sr-only">Fecha</dt>
            <dd>
              {plan.plannedFor ? formatLongDate(plan.plannedFor) : "Sin fecha"}
              {plan.status === "pending" && days !== null && (
                <span className={`ml-2 font-semibold ${days < 0 ? "text-blush-500" : "text-lavender-500"}`}>{formatRelativeDays(days)}</span>
              )}
            </dd>
          </div>
          {plan.placeName && (
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-ink-soft" aria-hidden />
              <dt className="sr-only">Lugar</dt>
              <dd>{plan.placeName}</dd>
            </div>
          )}
          {plan.budget && (
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-ink-soft" aria-hidden />
              <dt className="sr-only">Presupuesto</dt>
              <dd>{formatMoney(plan.budget.amountCents, plan.budget.currency)}</dd>
            </div>
          )}
        </dl>

        {plan.description && <p className="mt-4 leading-relaxed whitespace-pre-line">{plan.description}</p>}
        <p className="mt-5 text-xs text-ink-soft">Propuesto por {plan.author.displayName}</p>
      </Card>

      {plan.status === "done" && (
        <Card className="animate-fade-up">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg">¿Cómo fue?</h2>
            <Link to={`/planes/${plan.id}/editar`} className="flex items-center gap-1.5 text-sm font-semibold text-blush-500">
              <ImagePlus size={16} aria-hidden /> {plan.photos.length > 0 ? "Editar fotos" : "Añadir fotos"}
            </Link>
          </div>
          {plan.photos.length > 0 ? (
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {plan.photos.map((photo, index) => (
                <li key={photo.id}>
                  <MemoryPhoto photo={photo} alt={`Foto ${index + 1} de ${plan.title}`} className="aspect-square w-full rounded-2xl" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-ink-soft">Suban fotos de ese día para no olvidarlo.</p>
          )}
        </Card>
      )}

      {notice && (
        <p role="status" className="rounded-2xl bg-blush-50 px-4 py-3 text-center text-sm text-blush-700">
          {notice}
        </p>
      )}

      <div className="space-y-3">
        {plan.status === "pending" && (
          <>
            <Button className="w-full" onClick={() => changeStatus("done")} disabled={busy}>
              <Check size={18} aria-hidden /> ¡Lo hicimos!
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Link to={`/planes/${plan.id}/editar`} className="inline-flex items-center justify-center gap-2 rounded-full border border-blush-200 bg-paper px-4 py-3 font-semibold text-blush-700">
                <Pencil size={16} aria-hidden /> Editar
              </Link>
              <Button variant="secondary" className="!px-3 whitespace-nowrap" onClick={() => changeStatus("cancelled")} disabled={busy}>
                <X size={16} aria-hidden /> Cancelar plan
              </Button>
            </div>
          </>
        )}

        {plan.status === "done" &&
          (plan.resultingMemoryId ? (
            <Link to={`/recuerdos/${plan.resultingMemoryId}`} className="flex w-full items-center justify-center gap-2 rounded-full bg-blush-300 px-6 py-3 font-semibold text-ink shadow-soft">
              <BookHeart size={18} aria-hidden /> Ver el recuerdo
            </Link>
          ) : (
            <Button className="w-full" onClick={toMemory} disabled={busy}>
              <BookHeart size={18} aria-hidden /> Guardarlo como recuerdo
            </Button>
          ))}

        {plan.status !== "pending" && (
          <div className="grid grid-cols-2 gap-3">
            <Link to={`/planes/${plan.id}/editar`} className="inline-flex items-center justify-center gap-2 rounded-full border border-blush-200 bg-paper px-4 py-3 font-semibold text-blush-700">
              <Pencil size={16} aria-hidden /> Editar
            </Link>
            <Button variant="secondary" className="!px-3 whitespace-nowrap" onClick={() => changeStatus("pending")} disabled={busy}>
              <RotateCcw size={16} aria-hidden /> {plan.status === "cancelled" ? "Reactivar" : "Reabrir"}
            </Button>
          </div>
        )}
      </div>

      {confirmDelete ? (
        <Card className="text-center">
          <p className="font-semibold">¿Borrar este plan?</p>
          <p className="mt-1 text-sm text-ink-soft">Dejará de verse para los dos.{plan.resultingMemoryId ? " El recuerdo que creaste se queda." : ""}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={remove} disabled={busy} className="!bg-blush-500 !text-paper">
              Sí, borrar
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="ghost" className="w-full" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={16} aria-hidden /> Borrar plan
        </Button>
      )}
    </article>
  );
}
