import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, HeartHandshake, UserRound, type LucideIcon } from "lucide-react";
import type { CapsuleRecipientName } from "@shared/api";
import { nextYearlyOccurrence, todayIn, utcToZoned, zonedTimeToUtc } from "@shared/dates";
import { MAX_CAPSULE_LETTER_LENGTH, MAX_CAPSULE_MESSAGE_LENGTH, MAX_PHOTOS_PER_CAPSULE, capsuleInputSchema } from "@shared/schemas";
import { useMe } from "@/auth/AuthContext";
import { AudioRecorder, useAudioUpload } from "@/components/capsules/AudioRecorder";
import { PhotoUploader } from "@/components/memories/PhotoUploader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePhotoUploads } from "@/hooks/usePhotoUploads";
import { capsuleMediaUrl, capsulesApi } from "@/services/api/capsules";
import { formatDayMonth, formatLongDate, formatNumber } from "@/utils/format";

const inputClass =
  "mt-1 w-full rounded-2xl border border-blush-100 bg-cream px-4 py-3 text-ink outline-none focus:border-blush-300 focus:ring-2 focus:ring-blush-100";

interface FormState {
  recipient: CapsuleRecipientName;
  title: string;
  message: string;
  letter: string;
  unlockOn: string;
  unlockTime: string;
}

const EMPTY: FormState = { recipient: "partner", title: "", message: "", letter: "", unlockOn: "", unlockTime: "00:00" };

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** El mismo día dentro de `years` años (29/02 pasa a 28/02 si hace falta). */
function addYears(date: string, years: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y! + years, m!, 0)).getUTCDate();
  return new Date(Date.UTC(y! + years, m! - 1, Math.min(d!, lastDay))).toISOString().slice(0, 10);
}

/** Guardar (sin :id) o editar (con :id) una cápsula. */
export function CapsuleFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useMe();
  const relationship = me.relationship!;
  const timezone = relationship.timezone;
  const partner = relationship.members.find((member) => member.id !== me.user.id)?.displayName ?? "tu pareja";

  const [form, setForm] = useState<FormState>(EMPTY);
  const photos = usePhotoUploads("capsule");
  const audio = useAudioUpload();
  const { setSaved: setSavedPhotos } = photos;
  const { setSaved: setSavedAudio } = audio;
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    capsulesApi
      .get(id)
      .then((capsule) => {
        if (!capsule.canEdit || !capsule.contents) {
          setError("Esta cápsula ya no se puede editar.");
          return;
        }
        const unlock = utcToZoned(capsule.unlockAt, timezone);
        setForm({
          recipient: capsule.recipient,
          title: capsule.title,
          message: capsule.contents.message ?? "",
          letter: capsule.contents.letter ?? "",
          unlockOn: unlock.date,
          unlockTime: unlock.time,
        });
        setSavedPhotos(capsule.contents.photos.map((photo) => photo.id));
        const saved = capsule.contents.audio;
        setSavedAudio(saved ? { ...saved, url: capsuleMediaUrl(capsule.id, saved.id) } : null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "No se pudo cargar"))
      .finally(() => setLoading(false));
  }, [id, timezone, setSavedPhotos, setSavedAudio]);

  const set = <K extends keyof FormState>(name: K, value: FormState[K]) => setForm((f) => ({ ...f, [name]: value }));

  const today = todayIn(timezone);
  const tomorrow = addDays(today, 1);
  const anniversary = nextYearlyOccurrence(relationship.startedOn, tomorrow);
  const quickDates = [
    { label: "En un año", date: addYears(today, 1) },
    { label: `💞 Aniversario · ${formatDayMonth(anniversary.date)}`, date: anniversary.date },
    { label: "En 5 años", date: addYears(today, 5) },
  ];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (photos.busy || audio.busy) {
      setError("Espera a que terminen de subirse los archivos");
      return;
    }
    const parsed = capsuleInputSchema.safeParse({
      ...form,
      photoIds: photos.uploadedIds,
      audioId: audio.uploadedId,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos");
      return;
    }
    if (zonedTimeToUtc(parsed.data.unlockOn, parsed.data.unlockTime, timezone).getTime() <= Date.now()) {
      setError("La fecha de apertura tiene que ser en el futuro");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = id ? await capsulesApi.update(id, parsed.data) : await capsulesApi.create(parsed.data);
      navigate(`/futuro/${saved.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-96" />;

  const recipients: { value: CapsuleRecipientName; label: string; hint: string; icon: LucideIcon }[] = [
    { value: "partner", label: `Para ${partner}`, hint: "Solo lo abrirá cuando llegue la fecha", icon: UserRound },
    { value: "both", label: "Para los dos", hint: "Para abrirla juntos en el futuro", icon: HeartHandshake },
  ];

  return (
    <section>
      <header className="mb-5 flex items-center gap-3">
        <Link to={id ? `/futuro/${id}` : "/futuro"} aria-label="Volver" className="flex h-10 w-10 items-center justify-center rounded-full bg-paper shadow-soft">
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <div>
          <h1 className="text-2xl">{id ? "Editar cápsula" : "Nueva cápsula"}</h1>
          <p className="text-sm text-ink-soft">Algo de hoy para abrir más adelante</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="sr-only">¿Para quién es?</legend>
          {recipients.map(({ value, label, hint, icon: Icon }) => {
            const active = form.recipient === value;
            return (
              <label
                key={value}
                className={`flex cursor-pointer flex-col gap-1 rounded-card border-2 bg-paper p-4 shadow-soft transition ${active ? "border-blush-300" : "border-transparent"}`}
              >
                <input type="radio" name="recipient" value={value} checked={active} onChange={() => set("recipient", value)} className="sr-only" />
                <Icon size={22} strokeWidth={1.75} className={active ? "text-blush-500" : "text-ink-soft"} aria-hidden />
                <span className="font-semibold">{label}</span>
                <span className="text-xs leading-snug text-ink-soft">{hint}</span>
              </label>
            );
          })}
        </fieldset>

        <Card>
          <p className="text-sm font-semibold">¿Cuándo se podrá abrir?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {quickDates.map(({ label, date }) => (
              <button
                key={label}
                type="button"
                onClick={() => setForm((f) => ({ ...f, unlockOn: date, unlockTime: "00:00" }))}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${form.unlockOn === date ? "bg-blush-100 text-blush-700" : "bg-blush-50 text-blush-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
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
            {form.unlockOn
              ? `${form.recipient === "both" ? "Los dos verán" : `${partner} verá`} la cápsula cerrada hasta el ${formatLongDate(form.unlockOn)}. Su contenido no sale del servidor antes.`
              : "Hasta entonces solo se verá el título y la fecha."}
          </p>
        </Card>

        <Card className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold">Título</span>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} className={inputClass} placeholder="Para dentro de un año" />
            <span className="mt-1 block text-xs text-ink-soft">Es lo único que se ve antes de abrirla.</span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Mensaje</span>
            <textarea
              value={form.message}
              onChange={(e) => set("message", e.target.value)}
              rows={4}
              maxLength={MAX_CAPSULE_MESSAGE_LENGTH}
              className={`${inputClass} resize-y`}
              placeholder="Hoy estamos… y me imagino que dentro de un año…"
            />
          </label>
        </Card>

        <Card>
          <label className="block">
            <span className="text-sm font-semibold">Una pequeña carta</span>
            <span className="ml-1 text-xs text-ink-soft">(opcional)</span>
            <textarea
              value={form.letter}
              onChange={(e) => set("letter", e.target.value)}
              rows={6}
              maxLength={MAX_CAPSULE_LETTER_LENGTH}
              className={`${inputClass} resize-y leading-relaxed`}
              placeholder="Querido yo del futuro…"
            />
            <span className="mt-1 block text-right text-xs text-ink-soft">
              {formatNumber(form.letter.length)} / {formatNumber(MAX_CAPSULE_LETTER_LENGTH)}
            </span>
          </label>
        </Card>

        <Card>
          <p className="mb-3 text-sm font-semibold">Fotos</p>
          <PhotoUploader
            photos={photos.photos}
            onAdd={photos.addPhotos}
            onRemove={photos.remove}
            onMakeCover={photos.makeCover}
            max={MAX_PHOTOS_PER_CAPSULE}
            thumbUrl={(mediaId) => (id ? capsuleMediaUrl(id, mediaId, "thumb") : "")}
            hint={`Hasta ${MAX_PHOTOS_PER_CAPSULE} fotos. Se comprimen y quedan guardadas sin que nadie más pueda verlas antes de la fecha.`}
          />
        </Card>

        <Card>
          <p className="mb-3 text-sm font-semibold">Audio</p>
          <AudioRecorder audio={audio.audio} upload={audio.upload} remove={audio.remove} />
        </Card>

        {error && (
          <p role="alert" className="rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-700">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={saving || photos.busy || audio.busy}>
          {saving ? "Guardando…" : id ? "Guardar cambios" : "Cerrar la cápsula"}
        </Button>
      </form>
    </section>
  );
}
