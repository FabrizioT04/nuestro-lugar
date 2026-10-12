import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { MEMORY_CATEGORIES, memoryInputSchema } from "@shared/schemas";
import { PhotoUploader } from "@/components/memories/PhotoUploader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePhotoUploads } from "@/hooks/usePhotoUploads";
import { submitAction } from "@/offline/sync";
import { memoriesApi } from "@/services/api/memories";
import type { MemoryDetail } from "@shared/api";

const inputClass =
  "mt-1 w-full rounded-2xl border border-blush-100 bg-cream px-4 py-3 text-ink outline-none focus:border-blush-300 focus:ring-2 focus:ring-blush-100";

const today = () => new Date().toISOString().slice(0, 10);

interface FormState {
  title: string;
  happenedOn: string;
  placeName: string;
  category: string;
  tags: string;
  description: string;
  isHighlighted: boolean;
}

const EMPTY: FormState = { title: "", happenedOn: today(), placeName: "", category: "", tags: "", description: "", isHighlighted: false };

/** Crear (sin :id) o editar (con :id) un recuerdo. */
export function MemoryFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const uploads = usePhotoUploads("memory");
  const { setSaved } = uploads;
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    memoriesApi
      .get(id)
      .then((memory) => {
        setForm({
          title: memory.title,
          happenedOn: memory.happenedOn,
          placeName: memory.placeName ?? "",
          category: memory.category ?? "",
          tags: memory.tags.join(", "),
          description: memory.description ?? "",
          isHighlighted: memory.isHighlighted,
        });
        setSaved(memory.photos.map((p) => p.id));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "No se pudo cargar"))
      .finally(() => setLoading(false));
  }, [id, setSaved]);

  const set = <K extends keyof FormState>(name: K, value: FormState[K]) => setForm((f) => ({ ...f, [name]: value }));
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = memoryInputSchema.safeParse({
      ...form,
      tags: form.tags
        .split(",")
        .map((t) => t.replace(/^#/, "").trim())
        .filter(Boolean),
      photoIds: uploads.uploadedIds,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos");
      return;
    }

    if (id && uploads.hasLocal) {
      setError("Necesitas conexión para añadir fotos a un recuerdo que ya existe.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (id) {
        const saved = await memoriesApi.update(id, parsed.data);
        navigate(`/recuerdos/${saved.id}`, { replace: true });
        return;
      }
      // Crear funciona también sin conexión: queda ⏳ pendiente y se envía al volver Internet.
      const { photoIds: _photoIds, ...input } = parsed.data;
      const result = await submitAction<"memory.create", MemoryDetail>(
        "memory.create",
        { input: { ...input, id: crypto.randomUUID() }, photos: await uploads.toSlots() },
        input.title,
      );
      navigate(result.status === "saved" ? `/recuerdos/${result.result.id}` : "/recuerdos", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  const busy = uploads.busy;

  if (loading) return <Skeleton className="h-96" />;

  return (
    <section>
      <header className="mb-5 flex items-center gap-3">
        <Link to={id ? `/recuerdos/${id}` : "/recuerdos"} aria-label="Volver" className="flex h-10 w-10 items-center justify-center rounded-full bg-paper shadow-soft">
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <h1 className="text-2xl">{id ? "Editar recuerdo" : "Nuevo recuerdo"}</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Card>
          <PhotoUploader photos={uploads.photos} onAdd={uploads.addPhotos} onRemove={uploads.remove} onMakeCover={uploads.makeCover} />
        </Card>

        <Card className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold">Título</span>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} required className={inputClass} placeholder="Nuestra primera cita" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-semibold">Fecha</span>
              <input type="date" value={form.happenedOn} max={today()} onChange={(e) => set("happenedOn", e.target.value)} required className={inputClass} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Categoría</span>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputClass}>
                <option value="">Ninguna</option>
                {MEMORY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                {form.category && !(MEMORY_CATEGORIES as readonly string[]).includes(form.category) && <option value={form.category}>{form.category}</option>}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-semibold">Lugar</span>
            <input value={form.placeName} onChange={(e) => set("placeName", e.target.value)} maxLength={200} className={inputClass} placeholder="¿Dónde fue?" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Etiquetas</span>
            <input value={form.tags} onChange={(e) => set("tags", e.target.value)} className={inputClass} placeholder="playa, verano, sorpresa" />
            <span className="mt-1 block text-xs text-ink-soft">Separadas por comas.</span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold">¿Qué pasó?</span>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={5} maxLength={5000} className={`${inputClass} resize-y`} placeholder="Cuéntalo como si fuera una carta…" />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-semibold">Destacar en el inicio</span>
              <span className="block text-xs text-ink-soft">Solo puede haber un recuerdo destacado.</span>
            </span>
            <input type="checkbox" checked={form.isHighlighted} onChange={(e) => set("isHighlighted", e.target.checked)} className="h-6 w-6 accent-blush-500" />
          </label>
        </Card>

        {error && (
          <p role="alert" className="rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-700">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={saving || busy}>
          {busy ? "Subiendo fotos…" : saving ? "Guardando…" : "Guardar recuerdo"}
        </Button>
      </form>
    </section>
  );
}
