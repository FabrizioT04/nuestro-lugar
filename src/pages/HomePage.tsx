import { Link } from "react-router";
import { ChevronRight, Mail, Sparkles } from "lucide-react";
import type { HomeResponse, UpcomingMoment } from "@shared/api";
import { CoverArt } from "@/components/CoverArt";
import { MemoryPhoto } from "@/components/memories/MemoryPhoto";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
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

      <section aria-labelledby="modules-title" className="animate-fade-up [animation-delay:240ms]">
        <h2 id="modules-title" className="mb-3 font-sans text-lg font-extrabold">
          Nuestros rincones
        </h2>
        <ul className="grid grid-cols-3 gap-2.5">
          {MODULES.map(({ to, label, icon: Icon, tone }) => (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col gap-2 rounded-[1.15rem] p-3 text-sm font-bold text-ink transition active:scale-[0.97] ${TONES[tone]}`}
              >
                <Icon size={22} strokeWidth={1.75} aria-hidden />
                <span className="text-ink">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function HomeContent({ data }: { data: HomeResponse }) {
  const names = data.relationship.members.map((member) => member.displayName).join(" & ");
  const duration = formatDuration(data.together);

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
            <span className="text-6xl font-extrabold tracking-tighter text-blush-500">{formatNumber(data.together.days)}</span>
            <span className="text-lg font-semibold text-ink">{data.together.days === 1 ? "día juntos" : "días juntos"}</span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {duration ? `${duration} · ` : ""}desde el {formatLongDate(data.relationship.startedOn)}
          </p>
        </div>
      </div>

      {data.nextMoment && <NextMomentCard moment={data.nextMoment} />}

      {data.unopenedLetters > 0 && (
        <Link to="/cartas" className="block animate-fade-up [animation-delay:150ms]">
          <Card className="flex items-center gap-4 !bg-lavender-100 transition active:scale-[0.99]">
            <span className="flex h-14 w-14 shrink-0 animate-float items-center justify-center rounded-full bg-paper text-lavender-500">
              <Mail size={24} strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg">
                {data.unopenedLetters === 1 ? "Tienes una carta sin abrir" : `Tienes ${plural(data.unopenedLetters, "carta")} sin abrir`}
              </p>
              <p className="text-sm text-ink-soft">{data.unopenedLetters === 1 ? "Te está esperando ♡" : "Te están esperando ♡"}</p>
            </div>
            <ChevronRight size={20} className="text-ink-soft" aria-hidden />
          </Card>
        </Link>
      )}

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
          {moment.title} <span aria-hidden>{moment.emoji}</span>
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

function HomeSkeleton() {
  return (
    <div className="space-y-5" aria-label="Cargando">
      <Skeleton className="h-80" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}
