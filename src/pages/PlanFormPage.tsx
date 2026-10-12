import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, X } from "lucide-react";
import type { PlanStatusName, PlanTypeName } from "@shared/api";
import { PLAN_TYPE_INFO } from "@shared/plans";
import { CURRENCIES, PLAN_TYPES, planInputSchema } from "@shared/schemas";
import { PhotoUploader } from "@/components/memories/PhotoUploader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePhotoUploads } from "@/hooks/usePhotoUploads";
import { submitAction } from "@/offline/sync";
import { plansApi, type PlanPayload } from "@/services/api/plans";
import type { PlanDetail } from "@shared/api";

const inputClass =
  "mt-1 w-full rounded-2xl border border-blush-100 bg-cream px-4 py-3 text-ink outline-none focus:border-blush-300 focus:ring-2 focus:ring-blush-100";

const CURRENCY_LABELS: Record<(typeof CURRENCIES)[number], string> = { PEN: "S/ (soles)", USD: "US$ (dólares)", EUR: "€ (euros)" };

const TITLE_IDEAS: Record<PlanTypeName, string> = {
  date: "Picnic en el parque",
  restaurant: "Probar ese restaurante de ramen",
  trip: "Fin de semana en Paracas",
  activity: "Clase de cerámica",
  movie: "Maratón de Harry Potter",
  goal: "Ahorrar para nuestro viaje",
  place_to_visit: "Conocer el Museo Larco",
  other: "Algo especial",
};

interface FormState {
  type: PlanTypeName;
  title: string;
  description: string;
  plannedFor: string;
  placeName: string;
  budget: string;
  currency: (typeof CURRENCIES)[number];
}

const EMPTY: FormState = { type: "date", title: "", description: "", plannedFor: "", placeName: "", budget: "", currency: "PEN" };

/** Crear (sin :id) o editar (con :id) un plan. Las fotos solo se piden cuando ya se realizó. */
export function PlanFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<PlanStatusName>("pending");
  const uploads = usePhotoUploads("plan");
  const { setSaved } = uploads;
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    plansApi
      .get(id)
      .then((plan) => {
        setForm({
          type: plan.type,
          title: plan.title,
          description: plan.description ?? "",
          plannedFor: plan.plannedFor ?? "",
          placeName: plan.placeName ?? "",
          budget: plan.budget ? String(plan.budget.amountCents / 100) : "",
          currency: (plan.budget?.currency as FormState["currency"] | undefined) ?? "PEN",
        });
        setStatus(plan.status);
        setSaved(plan.photos.map((photo) => photo.id));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "No se pudo cargar"))
      .finally(() => setLoading(false));
  }, [id, setSaved]);

  const set = <K extends keyof FormState>(name: K, value: FormState[K]) => setForm((f) => ({ ...f, [name]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const budgetText = form.budget.trim().replace(",", ".");
    const budget = budgetText === "" ? null : Number(budgetText);
    if (budget !== null && Number.isNaN(budget)) {
      setError("El presupuesto debe ser un número");
      return;
    }
    const payload: PlanPayload = {
      type: form.type,
      title: form.title,
      description: form.description,
      plannedFor: form.plannedFor || null,
      placeName: form.placeName,
      budget,
      currency: budget === null ? null : form.currency,
      photoIds: uploads.uploadedIds,
    };
    const parsed = planInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos");
      return;
    }

    if (id && uploads.hasLocal) {
      setError("Necesitas conexión para añadir fotos a un plan que ya existe.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (id) {
        const saved = await plansApi.update(id, payload);
        navigate(`/planes/${saved.id}`, { replace: true });
        return;
      }
      const { photoIds: _photoIds, ...input } = payload;
      const result = await submitAction<"plan.create", PlanDetail>(
        "plan.create",
        { input: { ...input, id: crypto.randomUUID() }, photos: await uploads.toSlots() },
        input.title,
      );
      navigate(result.status === "saved" ? `/planes/${result.result.id}` : "/planes", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-96" />;

  return (
    <section>
      <header className="mb-5 flex items-center gap-3">
        <Link to={id ? `/planes/${id}` : "/planes"} aria-label="Volver" className="flex h-10 w-10 items-center justify-center rounded-full bg-paper shadow-soft">
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <h1 className="text-2xl">{id ? "Editar plan" : "Nuevo plan"}</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {status === "done" && (
          <Card>
            <p className="mb-3 text-sm font-semibold">Fotos de cómo fue</p>
            <PhotoUploader photos={uploads.photos} onAdd={uploads.addPhotos} onRemove={uploads.remove} onMakeCover={uploads.makeCover} />
          </Card>
        )}

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">¿Qué tipo de plan?</legend>
          <div className="grid grid-cols-4 gap-2">
            {PLAN_TYPES.map((value) => {
              const active = form.type === value;
              return (
                <label
                  key={value}
                  className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 bg-paper px-1 py-3 text-center shadow-soft transition ${
                    active ? "border-blush-300" : "border-transparent"
                  }`}
                >
                  <input type="radio" name="type" value={value} checked={active} onChange={() => set("type", value)} className="sr-only" />
                  <span className="text-2xl" aria-hidden>
                    {PLAN_TYPE_INFO[value].emoji}
                  </span>
                  <span className="text-[11px] leading-tight font-semibold">{PLAN_TYPE_INFO[value].label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Card className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold">Título</span>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} className={inputClass} placeholder={TITLE_IDEAS[form.type]} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Fecha (opcional)</span>
            <div className="relative">
              <input type="date" value={form.plannedFor} onChange={(e) => set("plannedFor", e.target.value)} className={`${inputClass} pr-12`} />
              {form.plannedFor && (
                <button type="button" onClick={() => set("plannedFor", "")} aria-label="Quitar fecha" className="absolute top-1/2 right-3 mt-0.5 -translate-y-1/2 rounded-full p-1.5 text-ink-soft hover:bg-blush-50">
                  <X size={16} aria-hidden />
                </button>
              )}
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Lugar (opcional)</span>
            <input value={form.placeName} onChange={(e) => set("placeName", e.target.value)} maxLength={200} className={inputClass} placeholder="¿Dónde?" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block min-w-0">
              <span className="text-sm font-semibold">Presupuesto</span>
              <input value={form.budget} onChange={(e) => set("budget", e.target.value)} inputMode="decimal" className={`${inputClass} min-w-0`} placeholder="Opcional" />
            </label>
            <label className="block min-w-0">
              <span className="text-sm font-semibold">Moneda</span>
              <select value={form.currency} onChange={(e) => set("currency", e.target.value as FormState["currency"])} className={`${inputClass} min-w-0`}>
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {CURRENCY_LABELS[currency]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-semibold">Detalles (opcional)</span>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} maxLength={5000} className={`${inputClass} resize-y`} placeholder="Qué llevar, a qué hora, ideas…" />
          </label>
        </Card>

        {error && (
          <p role="alert" className="rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-700">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={saving || uploads.busy}>
          {uploads.busy ? "Subiendo fotos…" : saving ? "Guardando…" : id ? "Guardar cambios" : "Crear plan"}
        </Button>
      </form>
    </section>
  );
}
