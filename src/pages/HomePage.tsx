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
  blush: "bg-blush-50 text-blush-500",
  lavender: "bg-lavender-100 text-lavender-500",
  cream: "bg-cream text-blush-700",
};

export function HomePage() {
  const home = useAsync(homeApi.get, { cacheKey: "home" });

  return (
    <div className="space-y-5">
      <header className="flex animate-fade-up items-center justify-between">
        <p className="font-display text-lg text-ink">
          Nuestro Lugar <span className="text-blush-300">♡</span>
        </p>
      </header>

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
        <h2 id="modules-title" className="mb-3 text-xl">
          Nuestros rincones
        </h2>
        <ul className="grid grid-cols-3 gap-3">
          {MODULES.map(({ to, label, icon: Icon, tone }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex flex-col items-center gap-2 rounded-card bg-paper px-2 py-4 text-sm font-semibold shadow-soft transition active:scale-[0.97]"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-full ${TONES[tone]}`}>
                  <Icon size={21} strokeWidth={1.75} aria-hidden />
                </span>
                {label}
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
      <Card padded={false} className="animate-fade-up overflow-hidden [animation-delay:60ms]">
        <div className="relative aspect-[4/3]">
          {data.relationship.coverMediaId ? (
            <img
              src={photoUrl(data.relationship.coverMediaId)}
              alt={`Foto de ${names}`}
              className="absolute inset-0 h-full w-full bg-blush-50 object-cover"
            />
          ) : (
            <CoverArt className="absolute inset-0 h-full w-full" />
          )}
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-paper/90 to-transparent px-5 pt-10 pb-4 font-display text-2xl text-ink">
            {names}
          </p>
        </div>
        <div className="px-5 pt-3 pb-5">
          <p className="flex items-baseline gap-2">
            <span className="font-display text-5xl text-blush-500">{formatNumber(data.together.days)}</span>
            <span className="text-lg font-semibold">{data.together.days === 1 ? "día juntos" : "días juntos"}</span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {duration ? `${duration} · ` : ""}desde el {formatLongDate(data.relationship.startedOn)}
          </p>
        </div>
      </Card>

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
  const card = (
    <Card className="flex items-center gap-4 transition active:scale-[0.99]">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-lavender-100 text-2xl" aria-hidden>
        {moment.emoji}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Próximo momento</p>
        <p className="truncate font-display text-lg">{moment.title}</p>
        <p className="text-sm">
          <span className="font-semibold text-blush-500">{formatCountdown(moment.daysUntil)}</span>
          <span className="text-ink-soft">
            {" "}
            · {formatDayMonth(moment.date)}
            {moment.years ? ` · ${plural(moment.years, "año")}` : ""}
          </span>
        </p>
      </div>
    </Card>
  );
  return moment.link ? (
    <Link to={moment.link} className="block animate-fade-up [animation-delay:120ms]">
      {card}
    </Link>
  ) : (
    <div className="animate-fade-up [animation-delay:120ms]">{card}</div>
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
