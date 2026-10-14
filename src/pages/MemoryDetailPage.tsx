import { useCallback, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, Heart, ImageUp, MapPin, Pencil, Trash2 } from "lucide-react";
import type { MemoryDetail } from "@shared/api";
import { useAuth } from "@/auth/AuthContext";
import { MemoryPhoto } from "@/components/memories/MemoryPhoto";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { writeCache } from "@/offline/cache";
import { submitAction } from "@/offline/sync";
import { memoriesApi } from "@/services/api/memories";
import { formatLongDate } from "@/utils/format";
import { FavoriteBurst } from "@/components/fx/FavoriteBurst";
import { PhotoLightbox } from "@/components/memories/PhotoLightbox";
import { HAPTICS, vibrate } from "@/fx/haptics";

const DOUBLE_TAP_MS = 280;

export function MemoryDetailPage() {
  const { id = "" } = useParams();
  const load = useCallback(() => memoriesApi.get(id), [id]);
  const memory = useAsync(load, { cacheKey: `memory:${id}` });

  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <Link to="/recuerdos" aria-label="Volver a recuerdos" className="flex h-10 w-10 items-center justify-center rounded-full bg-paper shadow-soft">
          <ArrowLeft size={20} aria-hidden />
        </Link>
      </header>
      {memory.status === "loading" && <Skeleton className="h-96" />}
      {memory.status === "error" && (
        <Card className="text-center">
          <p className="text-ink-soft">{memory.message}</p>
          <Link to="/recuerdos" className="mt-4 inline-block font-semibold text-blush-500">
            Volver a recuerdos
          </Link>
        </Card>
      )}
      {memory.status === "success" && (
        // Primero puede llegar la copia guardada y luego la del Worker: la key fuerza a mostrar la nueva.
        <MemoryContent key={`${memory.data.updatedAt}:${memory.data.isFavorite}`} initial={memory.data} />
      )}
    </section>
  );
}

function MemoryContent({ initial }: { initial: MemoryDetail }) {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [memory, setMemory] = useState(initial);
  const [current, setCurrent] = useState(0);
  const gallery = useRef<HTMLDivElement>(null);
  // En el teléfono se desliza con el dedo; en la computadora (sin gesto horizontal) con flechas, puntos o teclado.
  const goTo = (index: number) => {
    const el = gallery.current;
    if (!el) return;
    const target = Math.max(0, Math.min(index, el.children.length - 1));
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
  };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [likes, setLikes] = useState(0);
  const [bigHeart, setBigHeart] = useState(0);
  const [viewer, setViewer] = useState<{ index: number; origin: DOMRect } | null>(null);
  const lastTap = useRef<{ at: number; timer: number } | null>(null);

  // Un toque abre la foto en grande; dos toques seguidos le dan favorito (como en Instagram).
  function onPhotoTap(target: HTMLElement, index: number) {
    const now = Date.now();
    const previous = lastTap.current;
    if (previous && now - previous.at < DOUBLE_TAP_MS) {
      window.clearTimeout(previous.timer);
      lastTap.current = null;
      setBigHeart((count) => count + 1);
      if (!memory.isFavorite) void toggleFavorite();
      else vibrate(HAPTICS.like);
      return;
    }
    const origin = target.getBoundingClientRect();
    const timer = window.setTimeout(() => {
      lastTap.current = null;
      setViewer({ index, origin });
    }, DOUBLE_TAP_MS);
    lastTap.current = { at: now, timer };
  }
  const [busy, setBusy] = useState(false);

  async function toggleFavorite() {
    const next = !memory.isFavorite;
    if (next) {
      setLikes((count) => count + 1);
      vibrate(HAPTICS.like);
    }
    setMemory((m) => ({ ...m, isFavorite: next })); // optimista
    try {
      // Sin conexión queda ⏳ pendiente; se guarda también en la copia local para que no "vuelva atrás".
      const result = await submitAction("memory.favorite", { memoryId: memory.id, favorite: next }, `Favorito: ${memory.title}`);
      if (result.status === "queued") {
        void writeCache(`memory:${memory.id}`, { ...memory, isFavorite: next });
        setNotice("⏳ Se guardará cuando vuelva la conexión");
      }
    } catch {
      setMemory((m) => ({ ...m, isFavorite: !next }));
      setNotice("No se pudo actualizar el favorito");
    }
  }

  async function setAsCover() {
    const photo = memory.photos[current];
    if (!photo) return;
    setBusy(true);
    try {
      await memoriesApi.setCover(photo.id);
      await refresh();
      setNotice("Ahora es la foto principal del inicio ♡");
    } catch {
      setNotice("No se pudo cambiar la foto principal");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await memoriesApi.remove(memory.id);
      navigate("/recuerdos", { replace: true });
    } catch {
      setNotice("No se pudo borrar el recuerdo");
      setBusy(false);
    }
  }

  return (
    <article className="space-y-4">
      {viewer && memory.photos[viewer.index] && (
        <PhotoLightbox photo={memory.photos[viewer.index]!} origin={viewer.origin} alt={`Foto ${viewer.index + 1} de ${memory.title}`} onClose={() => setViewer(null)} />
      )}
      <Card padded={false} className="animate-fade-up overflow-hidden">
        {memory.photos.length > 0 ? (
          <div className="relative">
            <div
              ref={gallery}
              tabIndex={memory.photos.length > 1 ? 0 : undefined}
              aria-label={memory.photos.length > 1 ? "Fotos: desliza o usa las flechas" : undefined}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") goTo(current + 1);
                if (event.key === "ArrowLeft") goTo(current - 1);
              }}
              className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onScroll={(event) => {
                const el = event.currentTarget;
                setCurrent(Math.round(el.scrollLeft / el.clientWidth));
              }}
            >
              {memory.photos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  aria-label={`Ver en grande la foto ${index + 1}. Toca dos veces para darle favorito`}
                  onClick={(event) => onPhotoTap(event.currentTarget, index)}
                  className="w-full shrink-0 snap-center"
                >
                  <MemoryPhoto photo={photo} size="full" eager={index === 0} alt={`Foto ${index + 1} de ${memory.title}`} className="aspect-[4/5] w-full" />
                </button>
              ))}
            </div>
            {/* Doble toque: corazón grande en el centro. */}
            {bigHeart > 0 && (
              <span key={bigHeart} className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden data-testid="double-tap-heart">
                <Heart size={96} fill="currentColor" strokeWidth={0} className="animate-like-pop text-white drop-shadow-[0_6px_18px_rgb(212_47_88/0.55)]" />
              </span>
            )}
            {memory.photos.length > 1 && (
              <>
                {current > 0 && (
                  <button
                    type="button"
                    onClick={() => goTo(current - 1)}
                    aria-label="Foto anterior"
                    className="absolute top-1/2 left-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-paper/85 text-ink shadow-soft backdrop-blur transition active:scale-90"
                  >
                    <ChevronLeft size={22} aria-hidden />
                  </button>
                )}
                {current < memory.photos.length - 1 && (
                  <button
                    type="button"
                    onClick={() => goTo(current + 1)}
                    aria-label="Foto siguiente"
                    className="absolute top-1/2 right-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-paper/85 text-ink shadow-soft backdrop-blur transition active:scale-90"
                  >
                    <ChevronRight size={22} aria-hidden />
                  </button>
                )}
                <ol className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-label={`Foto ${current + 1} de ${memory.photos.length}`}>
                  {memory.photos.map((photo, index) => (
                    <li key={photo.id}>
                      <button
                        type="button"
                        onClick={() => goTo(index)}
                        aria-label={`Ver foto ${index + 1}`}
                        aria-current={index === current}
                        className="flex h-6 items-center"
                      >
                        <span className={`block h-1.5 rounded-full transition-all ${index === current ? "w-5 bg-paper" : "w-1.5 bg-paper/60"}`} />
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        ) : (
          <MemoryPhoto photo={null} className="aspect-[4/3] w-full" />
        )}

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl leading-tight">{memory.title}</h1>
            <button
              type="button"
              onClick={toggleFavorite}
              aria-pressed={memory.isFavorite}
              aria-label={memory.isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush-50 text-blush-500 transition active:scale-90"
            >
              {/* Al marcarlo late y suelta chispitas; la clave reinicia la animación cada vez. */}
              <Heart key={likes} size={20} fill={memory.isFavorite ? "currentColor" : "none"} className={likes > 0 && memory.isFavorite ? "animate-heart-beat" : undefined} aria-hidden />
              {likes > 0 && memory.isFavorite && <FavoriteBurst key={`burst-${likes}`} />}
            </button>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-ink-soft">
            <span>{formatLongDate(memory.happenedOn)}</span>
            {memory.placeName && (
              <span className="flex items-center gap-1">
                <MapPin size={14} aria-hidden /> {memory.placeName}
              </span>
            )}
          </p>

          {(memory.category || memory.tags.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {memory.category && (
                <Link to={`/recuerdos?categoria=${encodeURIComponent(memory.category)}`} className="rounded-full bg-lavender-100 px-3 py-1 text-xs font-semibold text-lavender-500">
                  {memory.category}
                </Link>
              )}
              {memory.tags.map((tag) => (
                <Link key={tag} to={`/recuerdos?etiqueta=${encodeURIComponent(tag)}`} className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink-soft">
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {memory.description && <p className="mt-4 leading-relaxed whitespace-pre-line">{memory.description}</p>}

          <p className="mt-5 text-xs text-ink-soft">
            Guardado por {memory.author.displayName} · {formatLongDate(memory.createdAt.slice(0, 10))}
          </p>
        </div>
      </Card>

      {notice && (
        <p role="status" className="rounded-2xl bg-lavender-100 px-4 py-3 text-center text-sm text-lavender-500">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link to={`/recuerdos/${memory.id}/editar`} className="inline-flex items-center justify-center gap-2 rounded-full border border-blush-200 bg-paper px-4 py-3 font-semibold text-blush-700">
          <Pencil size={16} aria-hidden /> Editar
        </Link>
        {memory.photos.length > 0 ? (
          <Button variant="secondary" onClick={setAsCover} disabled={busy}>
            <ImageUp size={16} aria-hidden /> Foto del inicio
          </Button>
        ) : (
          <span />
        )}
      </div>

      {confirmDelete ? (
        <Card className="text-center">
          <p className="font-semibold">¿Borrar este recuerdo?</p>
          <p className="mt-1 text-sm text-ink-soft">Dejará de verse para los dos.</p>
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
          <Trash2 size={16} aria-hidden /> Borrar recuerdo
        </Button>
      )}
    </article>
  );
}
