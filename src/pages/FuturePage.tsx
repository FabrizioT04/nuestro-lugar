import { Link } from "react-router";
import { Gift, Lock } from "lucide-react";
import type { CapsuleSummary } from "@shared/api";
import { useMe } from "@/auth/AuthContext";
import { CapsuleBox } from "@/components/capsules/CapsuleBox";
import { capsulePeople, capsuleStatus } from "@/components/capsules/capsuleStatus";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { capsulesApi } from "@/services/api/capsules";

const loadCapsules = () => capsulesApi.list();

export function FuturePage() {
  const me = useMe();
  const capsules = useAsync(loadCapsules, { cacheKey: "capsules" });
  const timezone = me.relationship?.timezone ?? "UTC";
  const partner = me.relationship?.members.find((member) => member.id !== me.user.id)?.displayName ?? "tu pareja";

  return (
    <section>
      <header className="mb-2 flex animate-fade-up items-center justify-between gap-3">
        <h1 className="text-3xl">Caja del futuro</h1>
        <Link to="/futuro/nueva" className="inline-flex items-center gap-2 rounded-full bg-pastel px-4 py-2.5 text-sm font-bold text-ink shadow-soft transition hover:brightness-105 active:scale-95">
          <Gift size={16} aria-hidden /> Guardar
        </Link>
      </header>
      <p className="mb-5 animate-fade-up text-ink-soft [animation-delay:40ms]">Cosas que guardamos hoy para abrirlas más adelante.</p>

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

  return (
    <div className="space-y-6">
      <Group title="Listas para abrir" items={ready} timezone={timezone} partner={partner} />
      <Group title="Esperando su fecha" items={waiting} timezone={timezone} partner={partner} />
      <Group title="Ya abiertas" items={opened} timezone={timezone} partner={partner} />
    </div>
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
    <Link to={`/futuro/${capsule.id}`} className="flex items-center gap-4 rounded-card bg-paper p-4 shadow-soft transition active:scale-[0.99]">
      <CapsuleBox state={status.box} className={`h-16 w-16 shrink-0 ${ready ? "animate-float" : ""}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{capsulePeople(capsule, partner)}</p>
        <p className={`truncate font-display text-lg ${ready ? "text-blush-700" : ""}`}>{capsule.title}</p>
        <p className={`text-sm ${ready ? "font-semibold text-blush-500" : "text-ink-soft"}`}>{status.label}</p>
        {status.countdown && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
            <Lock size={12} aria-hidden /> {status.countdown}
          </p>
        )}
      </div>
      {ready && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blush-500" aria-label="Sin abrir" />}
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
