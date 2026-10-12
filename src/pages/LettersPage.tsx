import { useCallback } from "react";
import { Link, useSearchParams } from "react-router";
import { Mail, PenLine } from "lucide-react";
import type { LetterSummary } from "@shared/api";
import { useMe } from "@/auth/AuthContext";
import { LetterListItem } from "@/components/letters/LetterListItem";
import { PendingList } from "@/components/sync/PendingList";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useOutbox } from "@/hooks/useOutbox";
import { lettersApi, type LetterBox } from "@/services/api/letters";

const tabClass = (active: boolean) =>
  `flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-blush-300 text-ink" : "text-ink-soft hover:text-ink"}`;

export function LettersPage() {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const box: LetterBox = params.get("bandeja") === "enviadas" ? "sent" : "received";
  const load = useCallback(() => lettersApi.list(box), [box]);
  const letters = useAsync(load, { cacheKey: `letters:${box}` });
  const pending = useOutbox("letter.create");

  const timezone = me.relationship?.timezone ?? "UTC";
  const partner = me.relationship?.members.find((member) => member.id !== me.user.id)?.displayName ?? "tu pareja";

  return (
    <section>
      <header className="mb-4 flex animate-fade-up items-center justify-between gap-3">
        <h1 className="text-3xl">Cartas</h1>
        <Link to="/cartas/nueva" className="inline-flex items-center gap-2 rounded-full bg-blush-300 px-4 py-2.5 text-sm font-semibold text-ink shadow-soft transition hover:bg-blush-200 active:scale-95">
          <PenLine size={16} aria-hidden /> Escribir
        </Link>
      </header>

      <div className="mb-5 flex animate-fade-up rounded-full bg-paper p-1 shadow-soft [animation-delay:40ms]" role="tablist" aria-label="Bandeja">
        <button type="button" role="tab" aria-selected={box === "received"} className={tabClass(box === "received")} onClick={() => setParams({}, { replace: true })}>
          Para mí
        </button>
        <button type="button" role="tab" aria-selected={box === "sent"} className={tabClass(box === "sent")} onClick={() => setParams({ bandeja: "enviadas" }, { replace: true })}>
          Para {partner}
        </button>
      </div>

      {box === "sent" && <PendingList type="letter.create" />}

      {letters.status === "loading" && (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}
      {letters.status === "error" && (
        <Card className="text-center">
          <p className="text-ink-soft">{letters.message}</p>
          <Button variant="secondary" className="mt-4" onClick={letters.reload}>
            Reintentar
          </Button>
        </Card>
      )}
      {letters.status === "success" &&
        (letters.data.items.length === 0 ? (
          box === "sent" && pending.length > 0 ? null : (
          <EmptyBox box={box} partner={partner} />
          )
        ) : box === "received" ? (
          <ReceivedLetters items={letters.data.items} timezone={timezone} />
        ) : (
          <LetterList items={letters.data.items} timezone={timezone} />
        ))}
    </section>
  );
}

function ReceivedLetters({ items, timezone }: { items: LetterSummary[]; timezone: string }) {
  const toOpen = items.filter((l) => !l.isLocked && !l.openedAt);
  const waiting = items.filter((l) => l.isLocked).sort((a, b) => (a.unlockAt ?? "").localeCompare(b.unlockAt ?? ""));
  const read = items.filter((l) => !l.isLocked && l.openedAt);

  return (
    <div className="space-y-6">
      <Group title="Para abrir" items={toOpen} timezone={timezone} />
      <Group title="Esperando su fecha" items={waiting} timezone={timezone} />
      <Group title="Ya leídas" items={read} timezone={timezone} />
    </div>
  );
}

function Group({ title, items, timezone }: { title: string; items: LetterSummary[]; timezone: string }) {
  if (items.length === 0) return null;
  return (
    <section className="animate-fade-up">
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-ink-soft uppercase">{title}</h2>
      <LetterList items={items} timezone={timezone} />
    </section>
  );
}

function LetterList({ items, timezone }: { items: LetterSummary[]; timezone: string }) {
  return (
    <ul className="space-y-3">
      {items.map((letter) => (
        <li key={letter.id} className="animate-fade-up">
          <LetterListItem letter={letter} timezone={timezone} />
        </li>
      ))}
    </ul>
  );
}

function EmptyBox({ box, partner }: { box: LetterBox; partner: string }) {
  return (
    <Card className="animate-fade-up px-6 py-10 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lavender-100 text-lavender-500">
        <Mail size={26} strokeWidth={1.75} aria-hidden />
      </span>
      <p className="mt-4 font-display text-xl">{box === "received" ? "Tu buzón está vacío" : "Escríbele algo bonito"}</p>
      <p className="mx-auto mt-2 max-w-xs text-ink-soft">
        {box === "received"
          ? `Cuando ${partner} te escriba, sus cartas aparecerán aquí.`
          : `Una carta para hoy, una para abrir cuando ${partner} te extrañe o una sorpresa para una fecha especial.`}
      </p>
      {box === "sent" && (
        <Link to="/cartas/nueva" className="mt-5 inline-flex items-center gap-2 rounded-full bg-blush-300 px-6 py-3 font-semibold text-ink">
          <PenLine size={18} aria-hidden /> Escribir carta
        </Link>
      )}
    </Card>
  );
}
