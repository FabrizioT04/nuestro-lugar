import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { ImportantDateTypeName } from "@shared/api";
import { IMPORTANT_DATE_TYPE_INFO } from "@shared/importantDates";
import { IMPORTANT_DATE_TYPES, importantDateInputSchema, type ImportantDatePayload } from "@shared/schemas";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { importantDatesApi } from "@/services/api/us";

const inputClass =
  "mt-1 w-full rounded-2xl border border-blush-100 bg-cream px-4 py-3 text-ink outline-none focus:border-blush-300 focus:ring-2 focus:ring-blush-100";

const TITLE_IDEAS: Record<ImportantDateTypeName, string> = {
  anniversary: "El día que nos conocimos",
  birthday: "Cumpleaños de…",
  first_time: "Nuestro primer beso",
  trip: "Primer viaje juntos",
  custom: "Un día especial",
};

interface FormState {
  type: ImportantDateTypeName;
  title: string;
  eventDate: string;
  recursYearly: boolean;
  emoji: string;
  notes: string;
}

const EMPTY: FormState = { type: "birthday", title: "", eventDate: "", recursYearly: true, emoji: "", notes: "" };

/** Crear (sin :id) o editar (con :id) una fecha importante. */
export function ImportantDateFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    importantDatesApi
      .get(id)
      .then((date) =>
        setForm({
          type: date.type,
          title: date.title,
          eventDate: date.eventDate,
          recursYearly: date.recursYearly,
          emoji: date.emoji === IMPORTANT_DATE_TYPE_INFO[date.type].emoji ? "" : date.emoji,
          notes: date.notes ?? "",
        }),
      )
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "No se pudo cargar"))
      .finally(() => setLoading(false));
  }, [id]);

  const set = <K extends keyof FormState>(name: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [name]: value }));
    setError(null);
  };

  // Cada tipo trae su propia idea de si se repite (un cumpleaños sí, un viaje no); se puede cambiar después.
  const chooseType = (type: ImportantDateTypeName) => setForm((f) => ({ ...f, type, recursYearly: IMPORTANT_DATE_TYPE_INFO[type].recursYearly }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload: ImportantDatePayload = { ...form, emoji: form.emoji || null };
    const parsed = importantDateInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (id) await importantDatesApi.update(id, payload);
      else await importantDatesApi.create(payload);
      navigate("/nosotros", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await importantDatesApi.remove(id);
      navigate("/nosotros", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar");
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-96" />;

  return (
    <section>
      <header className="mb-5 flex items-center gap-3">
        <Link to="/nosotros" aria-label="Volver" className="flex h-10 w-10 items-center justify-center rounded-full bg-paper shadow-soft">
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <h1 className="text-2xl">{id ? "Editar fecha" : "Nueva fecha"}</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">¿Qué se celebra?</legend>
          <div className="flex flex-wrap gap-2">
            {IMPORTANT_DATE_TYPES.map((value) => {
              const active = form.type === value;
              return (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-2 rounded-full border-2 bg-paper py-2 pr-4 pl-3 shadow-soft transition ${
                    active ? "border-blush-300" : "border-transparent"
                  }`}
                >
                  <input type="radio" name="type" value={value} checked={active} onChange={() => chooseType(value)} className="sr-only" />
                  <span className="text-xl" aria-hidden>
                    {IMPORTANT_DATE_TYPE_INFO[value].emoji}
                  </span>
                  <span className="text-sm font-semibold">{IMPORTANT_DATE_TYPE_INFO[value].label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Card className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold">Nombre</span>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} className={inputClass} placeholder={TITLE_IDEAS[form.type]} />
          </label>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <label className="block min-w-0">
              <span className="text-sm font-semibold">Fecha</span>
              <input type="date" value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} className={`${inputClass} min-w-0 px-3`} />
            </label>
            <label className="block min-w-0">
              <span className="text-sm font-semibold">Emoji</span>
              <input
                value={form.emoji}
                onChange={(e) => set("emoji", e.target.value)}
                maxLength={16}
                className={`${inputClass} min-w-0 px-3 text-center text-xl`}
                placeholder={IMPORTANT_DATE_TYPE_INFO[form.type].emoji}
                aria-describedby="emoji-help"
              />
            </label>
          </div>
          <p id="emoji-help" className="-mt-2 text-xs text-ink-soft">
            Si no eliges emoji se usa {IMPORTANT_DATE_TYPE_INFO[form.type].emoji}.
          </p>
          <label className="flex items-center justify-between gap-4 rounded-2xl bg-cream px-4 py-3">
            <span>
              <span className="block text-sm font-semibold">Se repite cada año</span>
              <span className="block text-xs text-ink-soft">Así aparece en la cuenta regresiva de Inicio.</span>
            </span>
            <input type="checkbox" checked={form.recursYearly} onChange={(e) => set("recursYearly", e.target.checked)} className="h-5 w-5 shrink-0 accent-blush-500" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Notas (opcional)</span>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} maxLength={500} className={`${inputClass} resize-y`} placeholder="Algo para recordar de ese día" />
          </label>
        </Card>

        {error && (
          <p role="alert" className="rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-700">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Guardando…" : id ? "Guardar cambios" : "Guardar fecha"}
        </Button>
      </form>

      {id &&
        (confirmDelete ? (
          <Card className="mt-4 text-center">
            <p className="font-semibold">¿Borrar esta fecha?</p>
            <p className="mt-1 text-sm text-ink-soft">Dejará de verse en Nosotros, en Inicio y en la historia.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleDelete} disabled={saving} className="!bg-blush-500 !text-paper">
                Sí, borrar
              </Button>
            </div>
          </Card>
        ) : (
          <Button variant="ghost" className="mt-4 w-full" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} aria-hidden /> Borrar fecha
          </Button>
        ))}
    </section>
  );
}
