import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Palette, Trash2, X } from "lucide-react";
import type { Drawing } from "@shared/api";
import { useMe } from "@/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useMarkSeen } from "@/hooks/useMarkSeen";
import { drawingUrl, drawingsApi } from "@/services/api/drawings";
import { formatDateTimeIn } from "@/utils/format";
import { prepareImage, type PreparedImage } from "@/utils/image";

const loadDrawings = () => drawingsApi.list();

/** Fotos de los dibujos que uno le deja al otro. */
export function DrawingsPage() {
  useMarkSeen("drawings");
  const me = useMe();
  const drawings = useAsync(loadDrawings, { cacheKey: "drawings" });
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<{ image: PreparedImage; preview: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [open, setOpen] = useState<Drawing | null>(null);
  const timezone = me.relationship?.timezone ?? "UTC";
  const partner = me.relationship?.members.find((member) => member.id !== me.user.id)?.displayName ?? "tu pareja";

  async function pick(file: File) {
    setPickError(null);
    setPreparing(true);
    try {
      const image = await prepareImage(file);
      setDraft({ image, preview: URL.createObjectURL(image.full) });
    } catch (err) {
      setPickError(err instanceof Error ? err.message : "No se pudo abrir la foto");
    } finally {
      setPreparing(false);
    }
  }

  function closeDraft() {
    if (draft) URL.revokeObjectURL(draft.preview);
    setDraft(null);
  }

  return (
    <section>
      <header className="mb-2 flex animate-fade-up items-center justify-between gap-3">
        <h1 className="text-3xl">Dibujos</h1>
        <button type="button" className="nl-action" onClick={() => inputRef.current?.click()} disabled={preparing}>
          <ImagePlus size={16} aria-hidden /> {preparing ? "Abriendo…" : "Subir dibujo"}
        </button>
      </header>
      <p className="mb-5 animate-fade-up text-sm text-ink-soft [animation-delay:40ms]">Tómale una foto a tu dibujo y déjaselo a {partner}.</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void pick(file);
        }}
      />
      {pickError && <p className="mb-4 rounded-xl bg-blush-50 px-4 py-3 text-sm text-blush-700">{pickError}</p>}

      {drawings.status === "loading" && (
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="aspect-square" />
          <Skeleton className="aspect-square" />
        </div>
      )}
      {drawings.status === "error" && (
        <Card className="text-center">
          <p className="text-ink-soft">{drawings.message}</p>
          <Button variant="secondary" className="mt-4" onClick={drawings.reload}>
            Reintentar
          </Button>
        </Card>
      )}
      {drawings.status === "success" &&
        (drawings.data.items.length === 0 ? (
          <Card className="text-center">
            <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blush-50 text-blush-500">
              <Palette size={26} strokeWidth={1.5} aria-hidden />
            </span>
            <p className="font-medium text-ink">Todavía no hay dibujos</p>
            <p className="mt-1 text-sm text-ink-soft">El primero que subas aparecerá aquí.</p>
          </Card>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {drawings.data.items.map((drawing) => (
              <li key={drawing.id}>
                <button
                  type="button"
                  onClick={() => setOpen(drawing)}
                  className="block w-full overflow-hidden rounded-2xl border border-blush-200 bg-paper text-left transition active:scale-[0.98]"
                >
                  <img src={drawingUrl(drawing.id, "thumb")} alt={drawing.caption ?? `Dibujo de ${drawing.author.displayName}`} loading="lazy" className="aspect-square w-full bg-blush-50 object-cover" />
                  <span className="block px-3 py-2">
                    <span className="block truncate text-sm font-medium text-ink">{drawing.caption ?? "Sin título"}</span>
                    <span className="block text-xs text-ink-soft">{drawing.isMine ? "Tuyo" : `De ${drawing.author.displayName}`}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}

      {draft && (
        <UploadSheet
          preview={draft.preview}
          image={draft.image}
          onCancel={closeDraft}
          onSent={() => {
            closeDraft();
            drawings.reload();
          }}
        />
      )}
      {open && (
        <DrawingViewer
          drawing={open}
          when={formatDateTimeIn(open.createdAt, timezone)}
          onClose={() => setOpen(null)}
          onDeleted={() => {
            setOpen(null);
            drawings.reload();
          }}
        />
      )}
    </section>
  );
}

function UploadSheet({ preview, image, onCancel, onSent }: { preview: string; image: PreparedImage; onCancel: () => void; onSent: () => void }) {
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    try {
      await drawingsApi.upload(image, caption);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir");
      setSending(false);
    }
  }

  return (
    <Overlay label="Subir dibujo" onClose={sending ? undefined : onCancel}>
      <img src={preview} alt="Tu dibujo" className="max-h-[50vh] w-full rounded-2xl bg-blush-50 object-contain" />
      <label className="mt-4 block text-sm font-medium text-ink" htmlFor="drawing-caption">
        Unas palabras (opcional)
      </label>
      <input
        id="drawing-caption"
        className="nl-input mt-1.5"
        maxLength={140}
        value={caption}
        placeholder="Te dibujé esto pensando en ti…"
        onChange={(event) => setCaption(event.target.value)}
      />
      {error && <p className="mt-3 text-sm text-blush-700">{error}</p>}
      <div className="mt-5 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={sending}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={() => void send()} disabled={sending}>
          {sending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </Overlay>
  );
}

function DrawingViewer({ drawing, when, onClose, onDeleted }: { drawing: Drawing; when: string; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("¿Borrar este dibujo? No se puede deshacer.")) return;
    setDeleting(true);
    try {
      await drawingsApi.remove(drawing.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar");
      setDeleting(false);
    }
  }

  return (
    <Overlay label={drawing.caption ?? "Dibujo"} onClose={onClose}>
      <img src={drawingUrl(drawing.id)} alt={drawing.caption ?? `Dibujo de ${drawing.author.displayName}`} className="max-h-[60vh] w-full rounded-2xl bg-blush-50 object-contain" />
      {drawing.caption && <p className="mt-4 text-lg text-ink">{drawing.caption}</p>}
      <p className="mt-1 text-sm text-ink-soft">
        {drawing.isMine ? "Lo subiste tú" : `De ${drawing.author.displayName}`} · {when}
      </p>
      {error && <p className="mt-3 text-sm text-blush-700">{error}</p>}
      {drawing.isMine && (
        <Button variant="ghost" className="mt-3 -ml-3" onClick={() => void remove()} disabled={deleting}>
          <Trash2 size={16} aria-hidden /> {deleting ? "Borrando…" : "Borrar"}
        </Button>
      )}
    </Overlay>
  );
}

function Overlay({ label, onClose, children }: { label: string; onClose?: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // En un portal: la animación de cambio de pantalla crea su propio apilamiento y la barra de abajo quedaría encima.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="animate-pop-in relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-paper/90 text-ink-soft shadow-sm">
            <X size={18} aria-hidden />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
