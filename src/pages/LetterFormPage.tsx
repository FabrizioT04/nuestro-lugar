import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, CalendarClock, Gift, HeartHandshake, Mail, type LucideIcon } from "lucide-react";
import type { LetterTypeName } from "@shared/api";
import { nextYearlyOccurrence, todayIn, utcToZoned, zonedTimeToUtc } from "@shared/dates";
import { MAX_LETTER_LENGTH, letterInputSchema, letterTypeNeedsDate } from "@shared/schemas";
import { useMe } from "@/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { submitAction } from "@/offline/sync";
import { lettersApi } from "@/services/api/letters";
import type { LetterDetail } from "@shared/api";
import { formatDayMonth, formatNumber } from "@/utils/format";

const inputClass =
  "mt-1 w-full rounded-2xl border border-blush-100 bg-cream px-4 py-3 text-ink outline-none focus:border-blush-300 focus:ring-2 focus:ring-blush-100";

const TYPES: { value: LetterTypeName; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "normal", label: "Carta", hint: "Se puede abrir desde ya", icon: Mail },
  { value: "open_when", label: "Ábreme cuando…", hint: "Para un momento concreto", icon: HeartHandshake },
  { value: "scheduled", label: "Programada", hint: "Verá el sobre; se abre en la fecha", icon: CalendarClock },
  { value: "surprise", label: "Sorpresa", hint: "No sabrá que existe hasta la fecha", icon: Gift },
];

const OPEN_WHEN_IDEAS = ["estés triste", "me extrañes", "no puedas dormir", "necesites reír", "tengas un mal día", "estemos lejos"];

const SUBMIT_LABELS: Record<LetterTypeName, string> = {
  normal: "Enviar carta",
  open_when: "Enviar carta",
  scheduled: "Programar carta",
  surprise: "Esconder sorpresa",
};

interface FormState {
  type: LetterTypeName;
  title: string;
  body: string;
  openWhenLabel: string;
  unlockOn: string;
  unlockTime: string;
}

const EMPTY: FormState = { type: "normal", title: "", body: "", openWhenLabel: "", unlockOn: "", unlockTime: "00:00" };

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** Escribir (sin :id) o editar (con :id) una carta. */
export function LetterFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useMe();
  const relationship = me.relationship!;
  const timezone = relationship.timezone;
  const partner = relationship.members.find((member) => member.id !== me.user.id)?.displayName ?? "tu pareja";

  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    lettersApi
      .get(id)
      .then((letter) => {
        if (!letter.canEdit) {
          setError("Esta carta ya no se puede editar.");
          return;
        }
        const unlock = letter.unlockAt ? utcToZoned(letter.unlockAt, timezone) : null;
        setForm({
          type: letter.type,
          title: letter.title,
          body: letter.body ?? "",
          openWhenLabel: letter.openWhenLabel ?? "",
          unlockOn: unlock?.date ?? "",
          unlockTime: unlock?.time ?? "00:00",
        });
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "No se pudo cargar"))
      .finally(() => setLoading(false));
  }, [id, timezone]);

  const set = <K extends keyof FormState>(name: K, value: FormState[K]) => setForm((f) => ({ ...f, [name]: value }));

  const today = todayIn(timezone);
  // El próximo aniversario que todavía no haya empezado (si es hoy, el del año que viene).
  const anniversary = nextYearlyOccurrence(relationship.startedOn, addDays(today, 1));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const title = form.title.trim() || (form.type === "open_when" && form.openWhenLabel.trim() ? `Ábreme cuando ${form.openWhenLabel.trim()}` : "");
    const parsed = letterInputSchema.safeParse({ ...form, title, unlockOn: form.unlockOn || null });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos");
      return;
    }
    if (parsed.data.unlockOn && zonedTimeToUtc(parsed.data.unlockOn, parsed.data.unlockTime, timezone).getTime() <= Date.now()) {
      setError("La fecha de apertura tiene que ser en el futuro");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (id) {
        const saved = await lettersApi.update(id, parsed.data);
        navigate(`/cartas/${saved.id}`, { replace: true });
        return;
      }
      const result = await submitAction<"letter.create", LetterDetail>(
        "letter.create",
        { input: { ...parsed.data, id: crypto.randomUUID() } },
        parsed.data.title,
      );
      navigate(result.status === "saved" ? `/cartas/${result.result.id}` : "/cartas?bandeja=enviadas", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-96" />;

  return (
    <section>
      <header className="mb-5 flex items-center gap-3">
        <Link to={id ? `/cartas/${id}` : "/cartas?bandeja=enviadas"} aria-label="Volver" className="flex h-10 w-10 items-center justify-center rounded-full bg-paper shadow-soft">
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <div>
          <h1 className="text-2xl">{id ? "Editar carta" : "Nueva carta"}</h1>
          <p className="text-sm text-ink-soft">Para {partner}</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="sr-only">Tipo de carta</legend>
          {TYPES.map(({ value, label, hint, icon: Icon }) => {
            const active = form.type === value;
            return (
              <label
                key={value}
                className={`flex cursor-pointer flex-col gap-1 rounded-card border-2 bg-paper p-4 shadow-soft transition ${
                  active ? "border-blush-300" : "border-transparent"
                }`}
              >
                <input type="radio" name="type" value={value} checked={active} onChange={() => set("type", value)} className="sr-only" />
                <Icon size={22} strokeWidth={1.75} className={active ? "text-blush-500" : "text-ink-soft"} aria-hidden />
                <span className="font-semibold">{label}</span>
                <span className="text-xs leading-snug text-ink-soft">{hint}</span>
              </label>
            );
          })}
        </fieldset>

        {form.type === "open_when" && (
          <Card>
            <label className="block">
              <span className="text-sm font-semibold">Ábreme cuando…</span>
              <input value={form.openWhenLabel} onChange={(e) => set("openWhenLabel", e.target.value)} maxLength={80} className={inputClass} placeholder="me extrañes" />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {OPEN_WHEN_IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => set("openWhenLabel", idea)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${form.openWhenLabel === idea ? "bg-lavender-300 text-ink" : "bg-lavender-100 text-lavender-500"}`}
                >
                  {idea}
                </button>
              ))}
            </div>
          </Card>
        )}

        {letterTypeNeedsDate(form.type) && (
          <Card>
            <p className="text-sm font-semibold">¿Cuándo se podrá abrir?</p>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, unlockOn: anniversary.date, unlockTime: "00:00" }))}
              className={`mt-2 rounded-full px-3 py-1.5 text-sm font-semibold ${form.unlockOn === anniversary.date ? "bg-blush-100 text-blush-700" : "bg-blush-50 text-blush-700"}`}
            >
              Nuestro aniversario · {formatDayMonth(anniversary.date)}
            </button>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block min-w-0">
                <span className="text-xs text-ink-soft">Fecha</span>
                <input type="date" value={form.unlockOn} min={today} onChange={(e) => set("unlockOn", e.target.value)} className={`${inputClass} min-w-0 px-3`} />
              </label>
              <label className="block min-w-0">
                <span className="text-xs text-ink-soft">Hora</span>
                <input type="time" value={form.unlockTime} onChange={(e) => set("unlockTime", e.target.value || "00:00")} className={`${inputClass} min-w-0 px-3`} />
              </label>
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              {form.type === "surprise"
                ? `${partner} no verá nada hasta ese momento.`
                : `${partner} verá el sobre cerrado con la fecha, pero no podrá leerla antes.`}
            </p>
          </Card>
        )}

        <Card className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold">Título</span>
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              maxLength={200}
              className={inputClass}
              placeholder={form.type === "open_when" && form.openWhenLabel ? `Ábreme cuando ${form.openWhenLabel}` : "Para ti"}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Carta</span>
            <textarea
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              rows={12}
              maxLength={MAX_LETTER_LENGTH}
              className={`${inputClass} resize-y leading-relaxed`}
              placeholder="Escribe desde el corazón…"
            />
            <span className="mt-1 block text-right text-xs text-ink-soft">
              {formatNumber(form.body.length)} / {formatNumber(MAX_LETTER_LENGTH)}
            </span>
          </label>
        </Card>

        {error && (
          <p role="alert" className="rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-700">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Guardando…" : id ? "Guardar cambios" : SUBMIT_LABELS[form.type]}
        </Button>
      </form>
    </section>
  );
}
