import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ChevronRight, Gift, Heart, Lock, Mail, Sparkles } from "lucide-react";
import type { HomeBadges, HomeResponse, PendingItem, UpcomingMoment } from "@shared/api";
import { daysBetween, utcToZoned } from "@shared/dates";
import { Celebration } from "@/components/fx/Celebration";
import { FloatingHearts } from "@/components/fx/HeartBurst";
import { MemoryPhoto } from "@/components/memories/MemoryPhoto";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useCountUp } from "@/hooks/useCountUp";
import { MODULES } from "@/layouts/navigation";
import { homeApi } from "@/services/api/home";
import { photoUrl } from "@/services/api/media";
import { formatCountdown, formatDayMonth, formatDuration, formatLongDate, formatNumber, plural } from "@/utils/format";

export function HomePage() {
  const home = useAsync(homeApi.get, { cacheKey: "home" });

  return (
    <div className="space-y-7">
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

      {/* Rincones en bloques, cada uno con su globito de novedades. */}
      <nav aria-label="Nuestros rincones" className="animate-fade-up [animation-delay:280ms]">
        <h2 className="mb-3 text-lg">Nuestros rincones</h2>
        <ul className="grid grid-cols-2 gap-2.5">
          {MODULES.map(({ to, label, icon: Icon, badge, tone }, index) => {
            const count = badge && home.status === "success" ? badgeCount(home.data, badge) : 0;
            return (
              <li key={to} className={`animate-tile-in ${index === 0 || isLoneLast(index) ? "col-span-2" : ""}`} style={{ animationDelay: `${320 + index * 70}ms` }}>
                <Link
                  to={to}
                  aria-label={count > 0 ? `${label}, ${plural(count, "novedad", "novedades")}` : undefined}
                  className={`relative flex min-h-22 flex-col justify-between gap-2.5 rounded-card p-4 text-ink transition duration-200 hover:-translate-y-0.5 hover:shadow-soft active:scale-[0.95] active:brightness-95 ${TONES[tone]}`}
                >
                  <Icon size={22} strokeWidth={1.8} aria-hidden />
                  <span>
                    <span className="block text-base font-semibold tracking-tight">{label}</span>
                    <span className="block text-xs text-ink-soft">{count > 0 ? plural(count, "novedad", "novedades") : "\u00a0"}</span>
                  </span>
                  {count > 0 && <CountBadge count={count} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Las copias guardadas antes de los globitos no traen `badges`: entonces solo cuentan las cartas. */
export function badgeCount(data: HomeResponse, badge: keyof HomeBadges): number {
  // Una copia guardada antes de un rincón nuevo no trae su número.
  if (data.badges) return data.badges[badge] ?? 0;
  return badge === "letters" ? data.unopenedLetters : 0;
}

/** El primer rincón va a lo ancho; si el último quedaría solo en su fila, también. */
const isLoneLast = (index: number) => index === MODULES.length - 1 && MODULES.length % 2 === 0;

const TONES = { blush: "bg-blush-100", lavender: "bg-lavender-100", mint: "bg-blush-50" } as const;

/** Globito con el número de novedades, como en las redes sociales. */
function CountBadge({ count }: { count: number }) {
  return (
    <span
      aria-hidden
      data-testid="count-badge"
      className="animate-pop-in absolute top-3 right-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-blush-500 px-1.5 text-xs leading-none font-bold text-white"
    >
      {count > 9 ? "9+" : count}
    </span>
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
      <section aria-label="Nuestra historia juntos" className="relative -mx-5 flex h-[26rem] animate-fade-in flex-col justify-end overflow-hidden rounded-b-[2rem] bg-ink text-white">
        {data.relationship.coverMediaId ? (
          <img src={photoUrl(data.relationship.coverMediaId)} alt={`Foto de ${names}`} className="absolute inset-0 h-full w-full animate-ken-burns object-cover" />
        ) : data.highlightedMemory?.cover ? (
          <MemoryPhoto photo={data.highlightedMemory.cover} size="full" eager alt={`Foto de ${names}`} className="absolute inset-0 h-full w-full animate-ken-burns" />
        ) : (
          <div aria-hidden className="absolute inset-0 animate-ken-burns bg-[radial-gradient(circle_at_75%_25%,#ffd6a8_0,#ff8aa3_28%,#7b5cc8_70%,#2a1f3d_100%)]" />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent via-45% to-black/70" />
        <FloatingHearts count={8} className="opacity-70" />
        <div className="relative px-5 pb-6">
          <p className="flex flex-wrap items-baseline gap-x-3 leading-none">
            <span className="text-6xl font-bold tracking-tighter">{formatNumber(days)}</span>
            <span className="text-2xl font-semibold tracking-tight">{data.together.days === 1 ? "día" : "días"}</span>
          </p>
          <h1 className="mt-3 text-base font-semibold tracking-normal text-white">
            {data.relationship.members.map((member, index) => (
              <span key={member.id}>
                {index > 0 && " y "}
                {member.displayName}
              </span>
            ))}
          </h1>
          <p className="mt-0.5 text-sm text-white/80">
            {duration ? `${duration} juntos · ` : ""}desde el {formatLongDate(data.relationship.startedOn)}
          </p>
        </div>
      </section>

      {celebrate && <Celebration seed={data.together.days} title={data.nextMoment?.title ?? ""} />}
      {data.nextMoment && <NextMomentCard moment={data.nextMoment} />}

      <Link
        to={data.highlightedMemory ? `/recuerdos/${data.highlightedMemory.id}` : "/recuerdos/nuevo"}
        className="block animate-fade-up [animation-delay:180ms]"
      >
        <Card className="flex items-center gap-4 !p-3.5 transition active:scale-[0.99]">
          {data.highlightedMemory?.cover ? (
            <MemoryPhoto photo={data.highlightedMemory.cover} className="h-16 w-16 shrink-0 rounded-2xl" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-paper text-blush-500">
              <Sparkles size={24} strokeWidth={1.75} aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Recuerdo destacado</p>
            {data.highlightedMemory ? (
              <>
                <p className="truncate text-lg font-semibold tracking-tight">{data.highlightedMemory.title}</p>
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
    <div className="flex items-center gap-3.5 rounded-card bg-ink p-4 text-white transition active:scale-[0.99]">
      <span className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/10 text-white" aria-hidden>
        <span className="text-2xl leading-none font-extrabold">{day}</span>
        <span className="mt-0.5 text-[11px] font-bold uppercase">{monthShort}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold tracking-tight">{moment.title}</p>
        <p className="text-sm text-white/65">
          {moment.years ? `Cumplen ${plural(moment.years, "año")}` : formatDayMonth(moment.date)}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-blush-500 px-3 py-2 text-xs font-bold text-white">{formatCountdown(moment.daysUntil)}</span>
    </div>
  );
  return (
    <section aria-labelledby="next-title" className="animate-fade-up [animation-delay:120ms]">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 id="next-title" className="text-lg">
          Lo que viene
        </h2>
        <Link to="/nosotros" className="text-sm font-semibold text-ink-soft">
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
        <h2 id="pending-title" className="text-lg">
          Por abrir
        </h2>
        {ready > 0 && (
          <span className="rounded-full bg-blush-500 px-2.5 py-1 text-xs font-bold text-white">
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
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-paper text-sage-700" aria-hidden>
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
      className={`flex flex-wrap items-center gap-3 rounded-card border p-4 transition active:scale-[0.99] ${
        item.isLocked ? "border-transparent bg-blush-50" : "border-transparent bg-blush-100"
      }`}
    >
      <span
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
          item.isLocked ? "bg-paper text-ink-soft/70" : isLetter ? "bg-paper text-blush-500" : "bg-paper text-lavender-500"
        }`}
        aria-hidden
      >
        <Icon size={22} strokeWidth={1.6} />
        {!item.isLocked && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-paper bg-blush-500" />}
      </span>
      <div className="min-w-24 flex-1">
        <p className="truncate font-bold text-ink">{item.title}</p>
        <p className="truncate text-sm text-ink-soft">
          {isLetter ? "Carta" : "Cápsula"} de {item.from}
          {item.isLocked && unlockDate ? ` · ${formatDayMonth(unlockDate)}` : ""}
        </p>
      </div>
      {item.isLocked ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-paper px-2.5 py-1.5 text-xs font-bold text-ink-soft">
          <Lock size={12} aria-hidden />
          {days <= 0 ? "Hoy" : days === 1 ? "Mañana" : `En ${plural(days, "día")}`}
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-ink px-3.5 py-2 text-xs font-semibold text-white">Abrir</span>
      )}
    </Link>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-5" aria-label="Cargando">
      <Skeleton className="-mx-5 h-[26rem] !rounded-t-none" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}
