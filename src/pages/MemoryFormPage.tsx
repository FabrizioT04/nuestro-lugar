import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { MEMORY_CATEGORIES, memoryInputSchema } from "@shared/schemas";
import { PhotoUploader, type PhotoItem } from "@/components/memories/PhotoUploader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { mediaApi } from "@/services/api/media";
import { memoriesApi } from "@/services/api/memories";
import { prepareImage } from "@/utils/image";

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
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
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
        setPhotos(memory.photos.map((p) => ({ key: p.id, status: "done", mediaId: p.id })));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "No se pudo cargar"))
      .finally(() => setLoading(false));
  }, [id]);

  const set = <K extends keyof FormState>(name: K, value: FormState[K]) => setForm((f) => ({ ...f, [name]: value }));
  const patchPhoto = (key: string, patch: Partial<PhotoItem>) =>
    setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  function addPhotos(files: File[]) {
    const items: PhotoItem[] = files.map((file) => ({
      key: crypto.randomUUID(),
      status: "processing",
      previewUrl: URL.createObjectURL(file),
    }));
    setPhotos((list) => [...list, ...items]);

    // Una a la vez: menos memoria en el móvil y no se dispara el límite de subidas.
    void (async () => {
      for (const [index, item] of items.entries()) {
        try {
          const prepared = await prepareImage(files[index]!);
          patchPhoto(item.key, { status: "uploading" });
          const uploaded = await mediaApi.upload(prepared);
          patchPhoto(item.key, { status: "done", mediaId: uploaded.id });
        } catch (err) {
          patchPhoto(item.key, { status: "error", error: err instanceof Error ? err.message : "No se pudo subir" });
        }
      }
    })();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = memoryInputSchema.safeParse({
      ...form,
      tags: form.tags
        .split(",")
        .map((t) => t.replace(/^#/, "").trim())
        .filter(Boolean),
      photoIds: photos.filter((p) => p.status === "done" && p.mediaId).map((p) => p.mediaId),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = id ? await memoriesApi.update(id, parsed.data) : await memoriesApi.create(parsed.data);
      navigate(`/recuerdos/${saved.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  const busy = photos.some((p) => p.status === "processing" || p.status === "uploading");

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
          <PhotoUploader
            photos={photos}
            onAdd={addPhotos}
            onRemove={(key) => setPhotos((list) => list.filter((p) => p.key !== key))}
            onMakeCover={(key) =>
              setPhotos((list) => {
                const chosen = list.find((p) => p.key === key);
                return chosen ? [chosen, ...list.filter((p) => p.key !== key)] : list;
              })
            }
          />
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
