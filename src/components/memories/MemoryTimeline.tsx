import { Link } from "react-router";
import { Heart } from "lucide-react";
import type { MemorySummary } from "@shared/api";
import { formatDayMonth } from "@/utils/format";
import { MemoryPhoto } from "./MemoryPhoto";

const monthName = new Intl.DateTimeFormat("es", { month: "long", timeZone: "UTC" });

interface MonthGroup {
  key: string;
  label: string;
  items: MemorySummary[];
}

interface YearGroup {
  year: string;
  months: MonthGroup[];
}

/** Agrupa recuerdos (ya ordenados del más nuevo al más antiguo) por año y mes. */
export function groupByYearAndMonth(memories: MemorySummary[]): YearGroup[] {
  const years: YearGroup[] = [];
  for (const memory of memories) {
    const year = memory.happenedOn.slice(0, 4);
    const monthKey = memory.happenedOn.slice(0, 7);
    let yearGroup = years.at(-1);
    if (yearGroup?.year !== year) {
      yearGroup = { year, months: [] };
      years.push(yearGroup);
    }
    let monthGroup = yearGroup.months.at(-1);
    if (monthGroup?.key !== monthKey) {
      const label = monthName.format(new Date(`${monthKey}-01T00:00:00Z`));
      monthGroup = { key: monthKey, label: label.charAt(0).toUpperCase() + label.slice(1), items: [] };
      yearGroup.months.push(monthGroup);
    }
    monthGroup.items.push(memory);
  }
  return years;
}

export function MemoryTimeline({ memories }: { memories: MemorySummary[] }) {
  return (
    <div className="space-y-8">
      {groupByYearAndMonth(memories).map((year) => (
        <section key={year.year} aria-label={year.year}>
          <h2 className="mb-3 font-display text-3xl text-blush-500">{year.year}</h2>
          <div className="relative ml-2 space-y-6 border-l-2 border-blush-100 pl-6">
            {year.months.map((month) => (
              <div key={month.key}>
                <h3 className="relative mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">
                  <span
                    className="absolute top-1/2 -left-[33px] h-3 w-3 -translate-y-1/2 rounded-full border-2 border-paper bg-blush-300"
                    aria-hidden
                  />
                  {month.label}
                </h3>
                <ul className="space-y-3">
                  {month.items.map((memory) => (
                    <li key={memory.id}>
                      <Link
                        to={`/recuerdos/${memory.id}`}
                        className="flex items-center gap-3 rounded-2xl bg-paper p-2 pr-4 shadow-soft transition active:scale-[0.99]"
                      >
                        <MemoryPhoto photo={memory.cover} className="h-16 w-16 shrink-0 rounded-xl" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{memory.title}</p>
                          <p className="truncate text-sm text-ink-soft">
                            {formatDayMonth(memory.happenedOn)}
                            {memory.placeName ? ` · ${memory.placeName}` : ""}
                          </p>
                        </div>
                        {memory.isFavorite && <Heart size={16} className="shrink-0 text-blush-500" fill="currentColor" aria-label="Favorito" />}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
