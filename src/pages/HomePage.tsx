import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ChevronRight, Gift, Heart, Lock, Mail, Sparkles } from "lucide-react";
import type { HomeResponse, PendingItem, UpcomingMoment } from "@shared/api";
import { daysBetween, utcToZoned } from "@shared/dates";
import { CoverArt } from "@/components/CoverArt";
import { FloatingHearts, HeartBurst } from "@/components/fx/HeartBurst";
import { MemoryPhoto } from "@/components/memories/MemoryPhoto";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useCountUp } from "@/hooks/useCountUp";
import { MODULES, type ModuleItem } from "@/layouts/navigation";
import { homeApi } from "@/services/api/home";
import { photoUrl } from "@/services/api/media";
import { formatCountdown, formatDayMonth, formatDuration, formatLongDate, formatNumber, plural } from "@/utils/format";

const TONES: Record<ModuleItem["tone"], string> = {
  blush: "bg-blush-100 text-blush-700",
  lavender: "bg-lavender-100 text-lavender-500",
  mint: "bg-sage-100 text-sage-700",
};

export function HomePage() {
  const home = useAsync(homeApi.get, { cacheKey: "home" });

  return (
    <div className="space-y-5">
      {home.status !== "success" && (
        <header className="flex animate-fade-up items-center justify-between">
          <p className="font-display text-lg text-ink">
            Nuestro Lugar <span className="text-blush-300">♡</span>
          </p>
        </header>
      )}

      {home.status === "loading" && <HomeSkeleton />}
      {home.status === "error" && (
        <Card className="text-center">
          <p className="text-ink-soft">{home.message}</p>
          <Button variant="secondary" className="mt-4" onClick={home.reload}>
            Reintentar
          </Button>
        </Card>
      )}
      {home.status === "success" && <HomeContent data={home.data} />}

      {home.status === "success" && <PendingSection data={home.data} />}

      {/* Accesos rápidos: compactos, para que el recordatorio de arriba sea lo principal. */}
      <nav aria-label="Nuestros rincones" className="animate-fade-up [animation-delay:280ms]">
        <ul className="grid grid-cols-6 gap-1">
          {MODULES.map(({ to, label, icon: Icon, tone }) => (
            <li key={to}>
              <Link to={to} className="flex flex-col items-center gap-1.5 text-[11px] font-bold text-ink-soft transition active:scale-95">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${TONES[tone]}`}>
                  <Icon size={21} strokeWidth={1.75} aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function HomeContent({ data }: { data: HomeResponse }) {
  const names = data.relationship.members.map((member) => member.displayName).join(" & ");
  const duration = formatDuration(data.together);
  const days = useCountUp(data.together.days);
  // El día de un aniversario o fecha especial se celebra con una lluvia de corazones, una vez por día.
  const celebrationKey = data.nextMoment?.daysUntil === 0 ? `nl:celebrado:${data.today}:${data.nextMoment.title}` : null;
  const [celebrate] = useState(() => celebrationKey !== null && !readFlag(celebrationKey));
  useEffect(() => {
    if (celebrationKey) writeFlag(celebrationKey);
  }, [celebrationKey]);

  return (
    <>
      {/* Su foto ocupa la parte de arriba y se funde en rosado claro (nada oscuro). */}
      <div className="relative -mx-5 -mt-[max(1.5rem,env(safe-area-inset-top))] h-[min(29rem,70vh)] animate-fade-in overflow-hidden rounded-b-[2.25rem] bg-blush-50">
        {data.relationship.coverMediaId ? (
          <img
            src={photoUrl(data.relationship.coverMediaId)}
            alt={`Foto de ${names}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <CoverArt className="absolute inset-0 h-full w-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-40% to-blush-50 to-92%" aria-hidden />
        <FloatingHearts />
        <p className="absolute top-[max(1rem,env(safe-area-inset-top))] left-5 rounded-full border border-white/40 bg-white/35 px-3.5 py-2 text-[13px] font-bold text-ink backdrop-blur-md">
          Nuestro Lugar <span className="text-blush-500">♡</span>
        </p>
        <div className="absolute inset-x-6 bottom-6 animate-fade-up [animation-delay:120ms]">
          <h1 className="text-[2rem] leading-tight text-ink">
            {data.relationship.members.map((member, index) => (
              <span key={member.id}>
                {index > 0 && <i className="text-blush-500"> &amp; </i>}
                {member.displayName}
              </span>
            ))}
          </h1>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="text-6xl font-extrabold tracking-tighter text-blush-500">{formatNumber(days)}</span>
            <span className="text-lg font-semibold text-ink">{data.together.days === 1 ? "día juntos" : "días juntos"}</span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {duration ? `${duration} · ` : ""}desde el {formatLongDate(data.relationship.startedOn)}
          </p>
        </div>
      </div>

      {celebrate && <HeartBurst seed={data.together.days} />}
      {data.nextMoment && <NextMomentCard moment={data.nextMoment} />}

      <Link
        to={data.highlightedMemory ? `/recuerdos/${data.highlightedMemory.id}` : "/recuerdos/nuevo"}
        className="block animate-fade-up [animation-delay:180ms]"
      >
        <Card className="flex items-center gap-4 transition active:scale-[0.99]">
          {data.highlightedMemory?.cover ? (
            <MemoryPhoto photo={data.highlightedMemory.cover} className="h-14 w-14 shrink-0 rounded-2xl" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blush-50 text-blush-500">
              <Sparkles size={24} strokeWidth={1.75} aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Recuerdo destacado</p>
            {data.highlightedMemory ? (
              <>
                <p className="truncate font-display text-lg">{data.highlightedMemory.title}</p>
                <p className="text-sm text-ink-soft">{formatLongDate(data.highlightedMemory.happenedOn)}</p>
              </>
            ) : (
              <p className="text-ink-soft">Guarden su primer recuerdo juntos.</p>
            )}
          </div>
          <ChevronRight size={20} className="text-ink-soft" aria-hidden />
        </Card>
      </Link>
    </>
  );
}

function NextMomentCard({ moment }: { moment: UpcomingMoment }) {
  const [, month = 1, day = 1] = moment.date.split("-").map(Number);
  const monthShort = new Intl.DateTimeFormat("es", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, month - 1, 1)))
    .replace(".", "");
  const card = (
    <Card className="flex items-center gap-3.5 !p-3.5 transition active:scale-[0.99]">
      <span className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-lavender-100 text-lavender-500" aria-hidden>
        <span className="text-2xl leading-none font-extrabold">{day}</span>
        <span className="mt-0.5 text-[11px] font-bold uppercase">{monthShort}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-ink">
          {moment.title}
        </p>
        <p className="text-sm text-ink-soft">
          {moment.years ? `Cumplen ${plural(moment.years, "año")}` : formatDayMonth(moment.date)}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-blush-100 px-2.5 py-1.5 text-xs font-extrabold text-blush-700">
        {formatCountdown(moment.daysUntil)}
      </span>
    </Card>
  );
  return (
    <section aria-labelledby="next-title" className="animate-fade-up [animation-delay:120ms]">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 id="next-title" className="font-sans text-lg font-extrabold">
          Lo que viene
        </h2>
        <Link to="/nosotros" className="text-sm font-bold text-blush-500">
          Ver fechas
        </Link>
      </div>
      {moment.link ? (
        <Link to={moment.link} className="block">
          {card}
        </Link>
      ) : (
        card
      )}
    </section>
  );
}

/** Marcas en este dispositivo (si el almacenamiento falla, se celebra igual). */
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Sin almacenamiento: no pasa nada.
  }
}

/** Recordatorio de lo que la otra persona dejó y todavía no abren: cartas y cápsulas. */
function PendingSection({ data }: { data: HomeResponse }) {
  // Una copia antigua guardada sin conexión puede no traer este campo.
  const items = data.pending;
  const ready = items?.filter((item) => !item.isLocked).length ?? data.unopenedLetters;

  return (
    <section aria-labelledby="pending-title" className="animate-fade-up [animation-delay:220ms]">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 id="pending-title" className="font-sans text-lg font-extrabold">
          Por abrir
        </h2>
        {ready > 0 && (
          <span className="rounded-full bg-blush-100 px-2.5 py-1 text-xs font-extrabold text-blush-700">
            {ready === 1 ? "1 te espera" : `${ready} te esperan`}
          </span>
        )}
      </div>

      {items == null ? (
        data.unopenedLetters > 0 ? (
          <Link to="/cartas" className="block">
            <Card className="flex items-center gap-3.5 !bg-lavender-100 !p-4">
              <Mail size={22} className="shrink-0 text-lavender-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">
                  {data.unopenedLetters === 1 ? "Tienes una carta sin abrir" : `Tienes ${plural(data.unopenedLetters, "carta")} sin abrir`}
                </p>
                <p className="text-sm text-ink-soft">Conéctate para actualizar las cartas y cápsulas pendientes.</p>
              </div>
              <ChevronRight size={20} className="shrink-0 text-ink-soft" aria-hidden />
            </Card>
          </Link>
        ) : (
          <Card className="!p-4">
            <p className="text-sm text-ink-soft">Conéctate para actualizar las cartas y cápsulas pendientes.</p>
          </Card>
        )
      ) : items.length === 0 ? (
        <Card className="flex items-center gap-3.5 !p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sage-100 text-sage-700" aria-hidden>
            <Heart size={20} strokeWidth={1.75} />
          </span>
          <div>
            <p className="font-bold text-ink">Todo abierto ♡</p>
            <p className="text-sm text-ink-soft">No tienen cartas ni cápsulas pendientes.</p>
          </div>
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <PendingRow item={item} today={data.today} timezone={data.relationship.timezone} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PendingRow({ item, today, timezone }: { item: PendingItem; today: string; timezone: string }) {
  const isLetter = item.kind === "letter";
  const Icon = isLetter ? Mail : Gift;
  const unlockDate = item.unlockAt ? utcToZoned(item.unlockAt, timezone).date : null;
  const days = unlockDate ? daysBetween(today, unlockDate) : 0;

  return (
    <Link
      to={isLetter ? `/cartas/${item.id}` : `/futuro/${item.id}`}
      className={`flex items-center gap-3.5 rounded-[1.4rem] border p-3.5 shadow-soft transition active:scale-[0.99] ${
        item.isLocked ? "border-blush-100/80 bg-paper" : "border-blush-200 bg-gradient-to-r from-blush-50 to-lavender-100/70"
      }`}
    >
      <span
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
          item.isLocked ? "bg-cream text-ink-soft/70" : isLetter ? "bg-paper text-blush-500" : "bg-paper text-lavender-500"
        }`}
        aria-hidden
      >
        <Icon size={22} strokeWidth={1.75} className={item.isLocked ? "" : "animate-float"} />
        {!item.isLocked && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-paper bg-blush-500" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-ink">{item.title}</p>
        <p className="truncate text-sm text-ink-soft">
          {isLetter ? "Carta" : "Cápsula"} de {item.from}
          {item.isLocked && unlockDate ? ` · ${formatDayMonth(unlockDate)}` : ""}
        </p>
      </div>
      {item.isLocked ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-cream px-2.5 py-1.5 text-xs font-bold text-ink-soft">
          <Lock size={12} aria-hidden />
          {days <= 0 ? "Hoy" : days === 1 ? "Mañana" : `En ${plural(days, "día")}`}
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-pastel px-3 py-1.5 text-xs font-extrabold text-ink">Abrir</span>
      )}
    </Link>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-5" aria-label="Cargando">
      <Skeleton className="h-80" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}
