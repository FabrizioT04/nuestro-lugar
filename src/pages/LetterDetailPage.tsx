import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Lock, Pencil, Trash2 } from "lucide-react";
import type { LetterDetail } from "@shared/api";
import { daysBetween, todayIn, utcToZoned } from "@shared/dates";
import { useMe } from "@/auth/AuthContext";
import { Envelope } from "@/components/letters/Envelope";
import { LETTER_TYPE_LABELS, letterStatus } from "@/components/letters/letterStatus";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { ApiError } from "@/services/api/client";
import { lettersApi } from "@/services/api/letters";
import { formatCountdown, formatDateTimeIn, formatLongDate } from "@/utils/format";

export function LetterDetailPage() {
  const { id = "" } = useParams();
  const load = useCallback(() => lettersApi.get(id), [id]);
  // Solo se guardan en el dispositivo las cartas ya desbloqueadas (spec 15); las bloqueadas no traen texto.
  const letter = useAsync(load, { cacheKey: `letter:${id}`, cacheIf: (data) => !data.isLocked });
  const back = letter.status === "success" && letter.data.isMine ? "/cartas?bandeja=enviadas" : "/cartas";

  return (
    <section>
      <header className="mb-4">
        <Link to={back} aria-label="Volver a cartas" className="flex h-10 w-10 items-center justify-center rounded-full bg-paper shadow-soft">
          <ArrowLeft size={20} aria-hidden />
        </Link>
      </header>
      {letter.status === "loading" && <Skeleton className="h-96" />}
      {letter.status === "error" && (
        <Card className="text-center">
          <p className="text-ink-soft">{letter.message}</p>
          <Link to="/cartas" className="mt-4 inline-block font-semibold text-blush-500">
            Volver a cartas
          </Link>
        </Card>
      )}
      {letter.status === "success" && <LetterContent key={`${letter.data.updatedAt}:${letter.data.openedAt}`} initial={letter.data} />}
    </section>
  );
}

function LetterContent({ initial }: { initial: LetterDetail }) {
  const me = useMe();
  const timezone = me.relationship?.timezone ?? "UTC";
  const [letter, setLetter] = useState(initial);
  const [justOpened, setJustOpened] = useState(false);

  if (letter.isMine) return <AuthorView letter={letter} timezone={timezone} />;
  if (letter.isLocked) return <LockedView letter={letter} timezone={timezone} />;
  if (letter.body === null) {
    return (
      <SealedView
        letter={letter}
        onOpened={(opened) => {
          setLetter(opened);
          setJustOpened(true);
        }}
      />
    );
  }
  return <LetterPaper letter={letter} timezone={timezone} animate={justOpened} />;
}

/** Carta cerrada que ya se puede abrir: abrirla es un gesto explícito y queda registrado. */
function SealedView({ letter, onOpened }: { letter: LetterDetail; onOpened: (letter: LetterDetail) => void }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setOpening(true);
    setError(null);
    try {
      onOpened(await lettersApi.open(letter.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir");
      setOpening(false);
    }
  }

  return (
    <Card className="animate-fade-up px-6 py-10 text-center">
      <Envelope state={letter.type === "open_when" ? "open-when" : "sealed"} className={`mx-auto h-36 w-52 ${opening ? "animate-pulse" : "animate-float"}`} />
      <p className="mt-6 text-xs font-semibold tracking-wide text-ink-soft uppercase">De {letter.author.displayName}</p>
      {letter.openWhenLabel && letter.title !== `Ábreme cuando ${letter.openWhenLabel}` && (
        <p className="mt-1 font-display text-lg text-lavender-500">Ábreme cuando {letter.openWhenLabel}</p>
      )}
      <h1 className="mt-1 text-2xl">{letter.title}</h1>
      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-700">
          {error}
        </p>
      )}
      <Button className="mt-6" onClick={open} disabled={opening}>
        {opening ? "Abriendo…" : "Abrir carta"}
      </Button>
      {letter.type === "open_when" && <p className="mt-3 text-xs text-ink-soft">Guárdala para cuando la necesites de verdad.</p>}
    </Card>
  );
}

function LockedView({ letter, timezone }: { letter: LetterDetail; timezone: string }) {
  const unlock = utcToZoned(letter.unlockAt!, timezone);
  const daysUntil = daysBetween(todayIn(timezone), unlock.date);
  return (
    <Card className="animate-fade-up px-6 py-10 text-center">
      <Envelope state="locked" className="mx-auto h-36 w-52" />
      <p className="mt-6 text-xs font-semibold tracking-wide text-ink-soft uppercase">De {letter.author.displayName}</p>
      <h1 className="mt-1 text-2xl">{letter.title}</h1>
      <p className="mt-3 font-semibold text-blush-500">{letterStatus(letter, timezone).label}</p>
      <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-ink-soft">
        <Lock size={14} aria-hidden />
        {daysUntil > 0 ? formatCountdown(daysUntil) : "Hoy"}
        {unlock.time !== "00:00" ? ` · a las ${unlock.time}` : ""}
      </p>
    </Card>
  );
}

function LetterPaper({ letter, timezone, animate }: { letter: LetterDetail; timezone: string; animate?: boolean }) {
  return (
    <article className={animate ? "animate-fade-up" : ""}>
      {animate && <Envelope state="opened" className="mx-auto -mb-6 h-28 w-40 animate-fade-in" />}
      <Card className="relative px-6 py-8">
        {letter.openWhenLabel && letter.title !== `Ábreme cuando ${letter.openWhenLabel}` && (
          <p className="font-display text-lavender-500">Ábreme cuando {letter.openWhenLabel}</p>
        )}
        <h1 className="text-2xl leading-tight">{letter.title}</h1>
        <p className="mt-1 text-xs text-ink-soft">
          {formatDateTimeIn(letter.createdAt, timezone)}
        </p>
        <div
          className="mt-6 text-[17px] leading-8 whitespace-pre-line"
          style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 31px, var(--color-blush-100) 31px 32px)" }}
        >
          {letter.body}
        </div>
        <p className="mt-6 text-right font-display text-lg text-blush-700">— {letter.author.displayName}</p>
      </Card>
    </article>
  );
}

function AuthorView({ letter, timezone }: { letter: LetterDetail; timezone: string }) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const status = letterStatus(letter, timezone);

  async function remove() {
    setBusy(true);
    try {
      await lettersApi.remove(letter.id);
      navigate("/cartas?bandeja=enviadas", { replace: true });
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "No se pudo borrar la carta");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex animate-fade-up items-center gap-4">
        <Envelope state={status.envelope} className="h-12 w-16 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
            {LETTER_TYPE_LABELS[letter.type]} · Para {letter.recipient.displayName}
          </p>
          <p className="font-semibold text-blush-500">{status.label}</p>
          {letter.unlockAt && letter.isLocked && <p className="text-xs text-ink-soft">{formatDateTimeIn(letter.unlockAt, timezone)}</p>}
          {letter.type === "surprise" && letter.isLocked && (
            <p className="text-xs text-ink-soft">{letter.recipient.displayName} no sabe que existe.</p>
          )}
        </div>
      </Card>

      <LetterPaper letter={letter} timezone={timezone} />

      {notice && (
        <p role="status" className="rounded-2xl bg-blush-50 px-4 py-3 text-center text-sm text-blush-700">
          {notice}
        </p>
      )}

      {letter.canEdit ? (
        <Link to={`/cartas/${letter.id}/editar`} className="flex w-full items-center justify-center gap-2 rounded-full border border-blush-200 bg-paper px-4 py-3 font-semibold text-blush-700">
          <Pencil size={16} aria-hidden /> Editar
        </Link>
      ) : (
        letter.openedAt && (
          <p className="text-center text-sm text-ink-soft">
            {letter.recipient.displayName} la abrió el {formatLongDate(utcToZoned(letter.openedAt, timezone).date)}. Ya no se puede editar.
          </p>
        )
      )}

      {confirmDelete ? (
        <Card className="text-center">
          <p className="font-semibold">¿Borrar esta carta?</p>
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
          <Trash2 size={16} aria-hidden /> Borrar carta
        </Button>
      )}
    </div>
  );
}
