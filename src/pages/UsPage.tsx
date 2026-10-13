import { Link } from "react-router";
import { CalendarCheck, Camera, ChevronRight, Heart, Images, Mail, MapPin, Plus, Route, type LucideIcon } from "lucide-react";
import type { ImportantDate, UpcomingMoment, UsResponse } from "@shared/api";
import { MemoryPhoto } from "@/components/memories/MemoryPhoto";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useMarkSeen } from "@/hooks/useMarkSeen";
import { usApi } from "@/services/api/us";
import { formatCountdown, formatDayMonth, formatDuration, formatLongDate, formatNumber, plural } from "@/utils/format";
import { IconTile } from "@/components/icons/EmojiIcon";

export function UsPage() {
  useMarkSeen("us");
  const us = useAsync(usApi.get, { cacheKey: "us" });

  return (
    <section className="space-y-5">
      {us.status === "loading" && (
        <div className="space-y-5" aria-label="Cargando">
          <Skeleton className="h-40" />
          <Skeleton className="h-48" />
          <Skeleton className="h-56" />
        </div>
      )}
      {us.status === "error" && (
        <Card className="text-center">
          <p className="text-ink-soft">{us.message}</p>
          <Button variant="secondary" className="mt-4" onClick={us.reload}>
            Reintentar
          </Button>
        </Card>
      )}
      {us.status === "success" && <UsContent data={us.data} />}
    </section>
  );
}

function UsContent({ data }: { data: UsResponse }) {
  const names = data.relationship.members.map((member) => member.displayName).join(" & ");
  const duration = formatDuration(data.together);
  const { stats } = data;

  const tiles: { label: string; value: number; icon: LucideIcon; to?: string }[] = [
    { label: stats.memories === 1 ? "recuerdo" : "recuerdos", value: stats.memories, icon: Camera, to: "/recuerdos" },
    { label: stats.photos === 1 ? "foto" : "fotos", value: stats.photos, icon: Images },
    { label: stats.places === 1 ? "lugar visitado" : "lugares visitados", value: stats.places, icon: MapPin },
    { label: stats.plansDone === 1 ? "plan realizado" : "planes realizados", value: stats.plansDone, icon: CalendarCheck, to: "/planes?estado=realizados" },
    { label: stats.lettersOpened === 1 ? "carta abierta" : "cartas abiertas", value: stats.lettersOpened, icon: Mail, to: "/cartas" },
    { label: stats.favorites === 1 ? "favorito" : "favoritos", value: stats.favorites, icon: Heart },
  ];

  return (
    <>
      <header className="animate-fade-up">
        <h1 className="text-3xl">Nosotros</h1>
        <p className="mt-2 text-sm text-ink-soft">{names}</p>
      </header>

      <Card className="animate-fade-up !border-transparent !bg-blush-100 py-7 text-center [animation-delay:60ms]">
        <p className="font-display text-6xl text-blush-500">{formatNumber(stats.daysTogether)}</p>
        <p className="text-lg font-semibold">{stats.daysTogether === 1 ? "día juntos" : "días juntos"}</p>
        <p className="mt-1 text-sm text-ink-soft">
          {duration ? `${duration} · ` : ""}desde el {formatLongDate(data.relationship.startedOn)}
        </p>
      </Card>

      <ul className="grid animate-fade-up grid-cols-3 gap-3 [animation-delay:120ms]">
        {tiles.map(({ label, value, icon: Icon, to }) => {
          const content = (
            <>
              <Icon size={20} strokeWidth={1.75} className="text-lavender-500" aria-hidden />
              <span className="font-display text-2xl">{formatNumber(value)}</span>
              <span className="text-xs leading-tight text-ink-soft">{label}</span>
            </>
          );
          const className = "flex h-full flex-col items-center gap-2 rounded-card border border-blush-200 bg-paper px-2 py-4 text-center";
          return (
            <li key={label}>
              {to ? (
                <Link to={to} className={`${className} transition active:scale-[0.97]`}>
                  {content}
                </Link>
              ) : (
                <div className={className}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      <Link to="/nosotros/historia" className="block animate-fade-up [animation-delay:160ms]">
        <Card className="flex items-center gap-4 !bg-blush-50 transition active:scale-[0.99]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-paper text-blush-500">
            <Route size={22} strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg">Nuestra historia</p>
            <p className="text-sm text-ink-soft">La línea de tiempo desde el primer día</p>
          </div>
          <ChevronRight size={20} className="text-ink-soft" aria-hidden />
        </Card>
      </Link>

      <ImportantDates anniversary={data.anniversary} dates={data.importantDates} />

      <section className="animate-fade-up [animation-delay:240ms]">
        <h2 className="mb-3 text-xl">Nuestros favoritos</h2>
        {data.favorites.length === 0 ? (
          <Card className="text-sm text-ink-soft">Toquen el ♡ en un recuerdo para guardarlo aquí.</Card>
        ) : (
          <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
            {data.favorites.map((memory) => (
              <li key={memory.id} className="w-36 shrink-0">
                <Link to={`/recuerdos/${memory.id}`} className="block overflow-hidden rounded-card border border-blush-100/80 bg-paper shadow-soft">
                  <MemoryPhoto photo={memory.cover} className="aspect-square w-full" />
                  <p className="truncate px-3 pt-2 text-sm font-semibold">{memory.title}</p>
                  <p className="px-3 pb-3 text-xs text-ink-soft">{formatLongDate(memory.happenedOn)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// Espacios duros dentro de cada parte: si la línea no cabe, se corta solo entre " · ".
const keepTogether = (text: string) => text.replace(/ /g, "\u00a0");

/** "2 de noviembre · cumple 23" o "12 de diciembre · 1 año". */
function yearlyDetail(nextDate: string, years: number | null, type?: ImportantDate["type"]): string {
  const parts = [formatDayMonth(nextDate)];
  if (years) parts.push(type === "birthday" ? `cumple ${years}` : plural(years, "año"));
  return parts.map(keepTogether).join(" · ");
}

function ImportantDates({ anniversary, dates }: { anniversary: UpcomingMoment; dates: ImportantDate[] }) {
  return (
    <section className="animate-fade-up [animation-delay:200ms]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl">Fechas importantes</h2>
        <Link to="/nosotros/fechas/nueva" className="flex items-center gap-1 text-sm font-semibold text-blush-500">
          <Plus size={16} aria-hidden /> Añadir
        </Link>
      </div>
      <Card padded={false} className="divide-y divide-blush-50">
        <DateRow
          emoji={anniversary.emoji}
          title={anniversary.title}
          detail={yearlyDetail(anniversary.date, anniversary.years)}
          daysUntil={anniversary.daysUntil}
        />
        {dates.map((date) => (
          <DateRow
            key={date.id}
            to={`/nosotros/fechas/${date.id}`}
            emoji={date.emoji}
            title={date.title}
            detail={date.recursYearly && date.nextDate ? yearlyDetail(date.nextDate, date.years, date.type) : formatLongDate(date.eventDate)}
            daysUntil={date.daysUntil}
          />
        ))}
      </Card>
      {dates.length === 0 && <p className="mt-2 text-sm text-ink-soft">Cumpleaños, el día que se conocieron, el primer viaje…</p>}
    </section>
  );
}

interface DateRowProps {
  emoji: string;
  title: string;
  detail: string;
  /** null si la fecha ya pasó y no se repite. */
  daysUntil: number | null;
  to?: string;
}

function DateRow({ emoji, title, detail, daysUntil, to }: DateRowProps) {
  const content = (
    <>
      <IconTile emoji={emoji} size="md" />
      <div className="min-w-0 flex-1">
        <p className="leading-snug font-semibold">{title}</p>
        <p className="text-sm text-ink-soft">
          {daysUntil !== null && (
            <>
              <span className="font-semibold text-blush-500">{keepTogether(formatCountdown(daysUntil))}</span> ·{" "}
            </>
          )}
          {detail}
        </p>
      </div>
      {to && <ChevronRight size={18} className="shrink-0 text-ink-soft" aria-hidden />}
    </>
  );
  return to ? (
    <Link to={to} className="flex items-center gap-3 px-5 py-3">
      {content}
    </Link>
  ) : (
    <div className="flex items-center gap-3 px-5 py-3">{content}</div>
  );
}
