import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Lock, Pencil, Trash2 } from "lucide-react";
import type { CapsuleDetail } from "@shared/api";
import { utcToZoned } from "@shared/dates";
import { useMe } from "@/auth/AuthContext";
import { CapsuleBox } from "@/components/capsules/CapsuleBox";
import { capsulePeople, capsuleStatus } from "@/components/capsules/capsuleStatus";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { ApiError } from "@/services/api/client";
import { capsuleMediaUrl, capsulesApi } from "@/services/api/capsules";
import { formatDateTimeIn, formatLongDate } from "@/utils/format";

export function CapsuleDetailPage() {
  const { id = "" } = useParams();
  const load = useCallback(() => capsulesApi.get(id), [id]);
  const capsule = useAsync(load);

  return (
    <section>
      <header className="mb-4">
        <Link to="/futuro" aria-label="Volver a la caja del futuro" className="flex h-10 w-10 items-center justify-center rounded-full bg-paper shadow-soft">
          <ArrowLeft size={20} aria-hidden />
        </Link>
      </header>
      {capsule.status === "loading" && <Skeleton className="h-96" />}
      {capsule.status === "error" && (
        <Card className="text-center">
          <p className="text-ink-soft">{capsule.message}</p>
          <Link to="/futuro" className="mt-4 inline-block font-semibold text-blush-500">
            Volver a la caja del futuro
          </Link>
        </Card>
      )}
      {capsule.status === "success" && <CapsuleContent initial={capsule.data} />}
    </section>
  );
}

function usePeople() {
  const me = useMe();
  return {
    timezone: me.relationship?.timezone ?? "UTC",
    partner: me.relationship?.members.find((member) => member.id !== me.user.id)?.displayName ?? "tu pareja",
  };
}

function CapsuleContent({ initial }: { initial: CapsuleDetail }) {
  const [capsule, setCapsule] = useState(initial);
  const [justOpened, setJustOpened] = useState(false);

  if (capsule.isMine) return <AuthorView capsule={capsule} />;
  if (capsule.isLocked) return <LockedView capsule={capsule} />;
  if (capsule.contents === null) {
    return (
      <ReadyView
        capsule={capsule}
        onOpened={(opened) => {
          setCapsule(opened);
          setJustOpened(true);
        }}
      />
    );
  }
  return <OpenedCapsule capsule={capsule} animate={justOpened} />;
}

/** Antes de la fecha: solo título, quién la guardó y cuándo se podrá abrir. El contenido no llegó al navegador. */
function LockedView({ capsule }: { capsule: CapsuleDetail }) {
  const { timezone, partner } = usePeople();
  const status = capsuleStatus(capsule, timezone);
  const unlock = utcToZoned(capsule.unlockAt, timezone);
  return (
    <Card className="animate-fade-up px-6 py-10 text-center">
      <CapsuleBox state="locked" className="mx-auto h-40 w-40" />
      <p className="mt-6 text-xs font-semibold tracking-wide text-ink-soft uppercase">{capsulePeople(capsule, partner)}</p>
      <h1 className="mt-1 text-2xl">{capsule.title}</h1>
      <p className="mt-3 font-semibold text-blush-500">{status.label}</p>
      <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-ink-soft">
        <Lock size={14} aria-hidden />
        {status.countdown}
        {unlock.time !== "00:00" ? ` · a las ${unlock.time}` : ""}
      </p>
    </Card>
  );
}

/** Ya llegó su fecha: abrirla es un gesto explícito y queda registrado. */
function ReadyView({ capsule, onOpened }: { capsule: CapsuleDetail; onOpened: (capsule: CapsuleDetail) => void }) {
  const { timezone, partner } = usePeople();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setOpening(true);
    setError(null);
    try {
      onOpened(await capsulesApi.open(capsule.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir");
      setOpening(false);
    }
  }

  return (
    <Card className="animate-fade-up px-6 py-10 text-center">
      <CapsuleBox state="ready" className={`mx-auto h-40 w-40 ${opening ? "animate-pulse" : "animate-float"}`} />
      <p className="mt-6 text-xs font-semibold tracking-wide text-ink-soft uppercase">{capsulePeople(capsule, partner)}</p>
      <h1 className="mt-1 text-2xl">{capsule.title}</h1>
      <p className="mt-2 text-sm text-ink-soft">Guardada el {formatLongDate(utcToZoned(capsule.createdAt, timezone).date)}</p>
      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-700">
          {error}
        </p>
      )}
      <Button className="mt-6" onClick={open} disabled={opening}>
        {opening ? "Abriendo…" : "Abrir cápsula"}
      </Button>
    </Card>
  );
}

function OpenedCapsule({ capsule, animate }: { capsule: CapsuleDetail; animate?: boolean }) {
  const { timezone } = usePeople();
  const contents = capsule.contents!;
  return (
    <article className={`space-y-4 ${animate ? "animate-fade-up" : ""}`}>
      {animate && <CapsuleBox state="opened" className="mx-auto -mb-2 h-28 w-28 animate-fade-in" />}
      <Card className="px-6 py-6">
        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
          Guardada el {formatLongDate(utcToZoned(capsule.createdAt, timezone).date)}
        </p>
        <h1 className="mt-1 text-2xl leading-tight">{capsule.title}</h1>
        {contents.message && <p className="mt-4 text-[17px] leading-relaxed whitespace-pre-line">{contents.message}</p>}
      </Card>

      {contents.photos.length > 0 && (
        <div className={`grid gap-2 ${contents.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {contents.photos.map((photo, index) => (
            <a key={photo.id} href={capsuleMediaUrl(capsule.id, photo.id)} target="_blank" rel="noreferrer" className="block">
              <img
                src={capsuleMediaUrl(capsule.id, photo.id, contents.photos.length === 1 ? "full" : "thumb")}
                alt={`Foto ${index + 1} de la cápsula`}
                width={photo.width ?? undefined}
                height={photo.height ?? undefined}
                loading="lazy"
                className={`w-full rounded-card bg-blush-50 object-cover shadow-soft ${contents.photos.length === 1 ? "max-h-[28rem]" : "aspect-square"}`}
              />
            </a>
          ))}
        </div>
      )}

      {contents.audio && (
        <Card className="bg-lavender-100">
          <p className="mb-2 text-sm font-semibold text-lavender-500">Un mensaje de voz</p>
          <audio controls preload="metadata" src={capsuleMediaUrl(capsule.id, contents.audio.id)} className="w-full" />
        </Card>
      )}

      {contents.letter && (
        <Card className="px-6 py-8">
          <p className="font-display text-lavender-500">Una pequeña carta</p>
          <div
            className="mt-4 text-[17px] leading-8 whitespace-pre-line"
            style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 31px, var(--color-blush-100) 31px 32px)" }}
          >
            {contents.letter}
          </div>
          <p className="mt-6 text-right font-display text-lg text-blush-700">— {capsule.author.displayName}</p>
        </Card>
      )}
    </article>
  );
}

function AuthorView({ capsule }: { capsule: CapsuleDetail }) {
  const navigate = useNavigate();
  const { timezone, partner } = usePeople();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const status = capsuleStatus(capsule, timezone);

  async function remove() {
    setBusy(true);
    try {
      await capsulesApi.remove(capsule.id);
      navigate("/futuro", { replace: true });
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "No se pudo borrar la cápsula");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex animate-fade-up items-center gap-4">
        <CapsuleBox state={status.box} className="h-14 w-14 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{capsulePeople(capsule, partner)}</p>
          <p className="font-semibold text-blush-500">{status.label}</p>
          {capsule.isLocked && (
            <p className="text-xs text-ink-soft">
              {formatDateTimeIn(capsule.unlockAt, timezone)} · {status.countdown}
            </p>
          )}
        </div>
      </Card>

      {capsule.isLocked && (
        <p className="px-2 text-center text-sm text-ink-soft">
          Esto es lo que guardaste. {partner} solo ve el título y la fecha hasta entonces.
        </p>
      )}

      <OpenedCapsule capsule={capsule} />

      {notice && (
        <p role="status" className="rounded-2xl bg-blush-50 px-4 py-3 text-center text-sm text-blush-700">
          {notice}
        </p>
      )}

      {capsule.canEdit && (
        <Link to={`/futuro/${capsule.id}/editar`} className="flex w-full items-center justify-center gap-2 rounded-full border border-blush-200 bg-paper px-4 py-3 font-semibold text-blush-700">
          <Pencil size={16} aria-hidden /> Editar
        </Link>
      )}

      {confirmDelete ? (
        <Card className="text-center">
          <p className="font-semibold">¿Borrar esta cápsula?</p>
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
          <Trash2 size={16} aria-hidden /> Borrar cápsula
        </Button>
      )}
    </div>
  );
}
