import { Link } from "react-router";
import { ArrowRight, Gift, Lock } from "lucide-react";
import { daysBetween, todayIn, utcToZoned } from "@shared/dates";
import type { CapsuleSummary } from "@shared/api";
import { useMe } from "@/auth/AuthContext";
import { CapsuleBox } from "@/components/capsules/CapsuleBox";
import { capsulePeople, capsuleStatus } from "@/components/capsules/capsuleStatus";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { capsulesApi } from "@/services/api/capsules";
import { formatLongDate, formatNumber } from "@/utils/format";

const loadCapsules = () => capsulesApi.list();

export function FuturePage() {
  const me = useMe();
  const capsules = useAsync(loadCapsules, { cacheKey: "capsules" });
  const timezone = me.relationship?.timezone ?? "UTC";
  const partner = me.relationship?.members.find((member) => member.id !== me.user.id)?.displayName ?? "tu pareja";

  return (
    <section>
      <header className="mb-2 flex animate-fade-up items-center justify-between gap-3">
        <h1 className="text-4xl tracking-tighter">Futuro</h1>
        <Link to="/futuro/nueva" className="nl-action">
          <Gift size={16} aria-hidden /> Cápsula
        </Link>
      </header>
      <p className="mb-5 animate-fade-up text-sm text-ink-soft [animation-delay:40ms]">Un pedacito de hoy para después.</p>

      {capsules.status === "loading" && (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}
      {capsules.status === "error" && (
        <Card className="text-center">
          <p className="text-ink-soft">{capsules.message}</p>
          <Button variant="secondary" className="mt-4" onClick={capsules.reload}>
            Reintentar
          </Button>
        </Card>
      )}
      {capsules.status === "success" &&
        (capsules.data.items.length === 0 ? (
          <EmptyBox partner={partner} />
        ) : (
          <CapsuleGroups items={capsules.data.items} timezone={timezone} partner={partner} />
        ))}
    </section>
  );
}

function CapsuleGroups({ items, timezone, partner }: { items: CapsuleSummary[]; timezone: string; partner: string }) {
  // El Worker ya las devuelve ordenadas por fecha de apertura.
  const ready = items.filter((c) => !c.isLocked && !c.openedAt);
  const waiting = items.filter((c) => c.isLocked);
  const opened = items.filter((c) => !c.isLocked && c.openedAt).reverse();
  const next = waiting[0];

  return (
    <div className="space-y-6">
      {next && <NextCapsule capsule={next} timezone={timezone} partner={partner} />}
      <Group title="Listas para abrir" items={ready} timezone={timezone} partner={partner} />
      <Group title="Esperando su fecha" items={waiting.slice(1)} timezone={timezone} partner={partner} />
      <Group title="Ya abiertas" items={opened} timezone={timezone} partner={partner} />
    </div>
  );
}

function NextCapsule({ capsule, timezone, partner }: { capsule: CapsuleSummary; timezone: string; partner: string }) {
  const unlockDate = utcToZoned(capsule.unlockAt, timezone).date;
  const days = Math.max(0, daysBetween(todayIn(timezone), unlockDate));
  return (
    <Link to={`/futuro/${capsule.id}`} className="block rounded-card bg-blush-100 px-5 py-7 text-center transition hover:bg-blush-50">
      <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-paper text-blush-500"><Gift size={30} strokeWidth={1.4} aria-hidden /></span>
      <p className="text-[11px] tracking-[0.14em] text-ink-soft uppercase">La próxima en abrirse</p>
      <h2 className="mt-2 text-xl">{capsule.title}</h2>
      <p className="mt-2 text-xs text-ink-soft">{capsulePeople(capsule, partner)}</p>
      <p className="mt-5 text-4xl font-medium tracking-tight text-blush-500">
        {days === 0 ? "Hoy" : <>{formatNumber(days)} <span className="text-sm font-normal tracking-normal text-ink-soft">{days === 1 ? "día" : "días"}</span></>}
      </p>
      <p className="mt-2 text-xs text-ink-soft">{formatLongDate(unlockDate)}</p>
      <p className="mt-5 flex items-center justify-center gap-2 border-t border-blush-200 pt-4 text-xs text-ink-soft"><Lock size={14} className="shrink-0" aria-hidden /> Su contenido espera hasta la fecha de apertura</p>
    </Link>
  );
}

function Group({ title, items, timezone, partner }: { title: string; items: CapsuleSummary[]; timezone: string; partner: string }) {
  if (items.length === 0) return null;
  return (
    <section className="animate-fade-up">
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-ink-soft uppercase">{title}</h2>
      <ul className="space-y-3">
        {items.map((capsule) => (
          <li key={capsule.id}>
            <CapsuleListItem capsule={capsule} timezone={timezone} partner={partner} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CapsuleListItem({ capsule, timezone, partner }: { capsule: CapsuleSummary; timezone: string; partner: string }) {
  const status = capsuleStatus(capsule, timezone);
  const ready = !capsule.isMine && !capsule.isLocked && !capsule.openedAt;
  return (
    <Link to={`/futuro/${capsule.id}`} className="flex items-center gap-3 rounded-card border border-blush-200 bg-paper p-4 transition active:scale-[0.99]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blush-50 text-blush-500">{capsule.isLocked ? <Lock size={21} strokeWidth={1.6} aria-hidden /> : <Gift size={23} strokeWidth={1.6} aria-hidden />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{capsulePeople(capsule, partner)}</p>
        <p className={`mt-1 font-display text-base font-medium break-words ${ready ? "text-blush-700" : ""}`}>{capsule.title}</p>
        <p className={`text-sm ${ready ? "font-semibold text-blush-500" : "text-ink-soft"}`}>{status.label}</p>
        {status.countdown && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
            <Lock size={12} aria-hidden /> {status.countdown}
          </p>
        )}
      </div>
      <ArrowRight size={17} className="shrink-0 text-blush-500" aria-label={ready ? "Sin abrir" : "Ver cápsula"} />
    </Link>
  );
}

function EmptyBox({ partner }: { partner: string }) {
  return (
    <Card className="animate-fade-up px-6 py-10 text-center">
      <CapsuleBox state="ready" className="mx-auto h-24 w-24" />
      <p className="mt-4 font-display text-xl">La caja está vacía</p>
      <p className="mx-auto mt-2 max-w-xs text-ink-soft">
        Guarda un mensaje, una foto, una nota de voz o una pequeña carta para que {partner} (o los dos) la abran dentro de un tiempo.
      </p>
      <Link to="/futuro/nueva" className="mt-5 inline-flex items-center gap-2 rounded-full bg-pastel px-6 py-3 font-bold text-ink">
        <Gift size={18} aria-hidden /> Guardar la primera
      </Link>
    </Card>
  );
}
