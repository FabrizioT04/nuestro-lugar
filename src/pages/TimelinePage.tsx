import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { TimelineEvent, TimelineResponse } from "@shared/api";
import { MemoryPhoto } from "@/components/memories/MemoryPhoto";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { usApi } from "@/services/api/us";
import { formatDayMonth, formatLongDate } from "@/utils/format";

interface YearGroup {
  year: string;
  events: TimelineEvent[];
}

/** Agrupa los eventos (ya ordenados del más antiguo al más nuevo) por año. */
function groupByYear(events: TimelineEvent[]): YearGroup[] {
  const years: YearGroup[] = [];
  for (const event of events) {
    const year = event.date.slice(0, 4);
    let group = years.at(-1);
    if (group?.year !== year) {
      group = { year, events: [] };
      years.push(group);
    }
    group.events.push(event);
  }
  return years;
}

/** Nuestra historia: del primer día hasta hoy, en orden. */
export function TimelinePage() {
  const timeline = useAsync(usApi.timeline, { cacheKey: "timeline" });

  return (
    <section>
      <header className="mb-5 flex items-center gap-3">
        <Link to="/nosotros" aria-label="Volver" className="flex h-10 w-10 items-center justify-center rounded-full bg-paper shadow-soft">
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <h1 className="text-2xl">Nuestra historia</h1>
      </header>

      {timeline.status === "loading" && (
        <div className="space-y-4" aria-label="Cargando">
          <Skeleton className="h-24" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}
      {timeline.status === "error" && (
        <Card className="text-center">
          <p className="text-ink-soft">{timeline.message}</p>
          <Button variant="secondary" className="mt-4" onClick={timeline.reload}>
            Reintentar
          </Button>
        </Card>
      )}
      {timeline.status === "success" && <Timeline data={timeline.data} />}
    </section>
  );
}

function Timeline({ data }: { data: TimelineResponse }) {
  const onlyStart = data.events.length <= 1;
  return (
    <div className="space-y-8">
      {groupByYear(data.events).map((group) => (
        <section key={group.year} aria-label={group.year}>
          <h2 className="mb-3 font-display text-3xl text-blush-500">{group.year}</h2>
          <ol className="relative ml-2 space-y-4 border-l-2 border-blush-100 pl-6">
            {group.events.map((event) => (
              <li key={event.key} className="relative">
                <span
                  className={`absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-paper ${
                    isMilestone(event) ? "-left-[35px] h-4 w-4 bg-blush-500" : "-left-[33px] h-3 w-3 bg-blush-300"
                  }`}
                  aria-hidden
                />
                <EventCard event={event} />
              </li>
            ))}
          </ol>
        </section>
      ))}

      <div className="relative ml-2 pl-6">
        <span className="absolute top-1/2 -left-[7px] h-4 w-4 -translate-y-1/2 animate-pulse rounded-full bg-lavender-500" aria-hidden />
        <p className="font-semibold">Hoy · {formatLongDate(data.today)}</p>
        <p className="text-sm text-ink-soft">{onlyStart ? "Aquí empiezan a aparecer los recuerdos y planes que vivan." : "Y lo que sigue."}</p>
      </div>
    </div>
  );
}

const isMilestone = (event: TimelineEvent) => event.kind === "start" || event.kind === "anniversary";

function EventCard({ event }: { event: TimelineEvent }) {
  const milestone = isMilestone(event);
  const content = (
    <>
      {event.cover ? (
        <MemoryPhoto photo={event.cover} className="h-16 w-16 shrink-0 rounded-xl" />
      ) : (
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl ${milestone ? "bg-paper" : "bg-lavender-100"}`}
          aria-hidden
        >
          {event.emoji}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${milestone ? "font-display text-lg" : "truncate"}`}>{event.title}</p>
        <p className="truncate text-sm text-ink-soft">
          {formatDayMonth(event.date)}
          {event.subtitle ? ` · ${event.subtitle}` : ""}
        </p>
      </div>
    </>
  );
  const className = `flex items-center gap-3 rounded-2xl p-2 pr-4 shadow-soft ${milestone ? "bg-blush-50" : "bg-paper"} ${event.cover ? "" : "pl-3"}`;
  return event.link ? (
    <Link to={event.link} className={`${className} transition active:scale-[0.99]`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
