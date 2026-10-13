import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Camera, GitCommitVertical, Heart, LayoutGrid, Plus, Search, Sparkles, X } from "lucide-react";
import type { MemoryFilters } from "@shared/api";
import { MemoryCard } from "@/components/memories/MemoryCard";
import { MemoryTimeline } from "@/components/memories/MemoryTimeline";
import { PendingList } from "@/components/sync/PendingList";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useMemoryList } from "@/hooks/useMemoryList";
import { useOutbox } from "@/hooks/useOutbox";
import { formatLongDate } from "@/utils/format";
import { memoriesApi } from "@/services/api/memories";

type View = "tarjetas" | "linea";

const chipClass = (active: boolean) =>
  `flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition ${
    active ? "border-blush-200 bg-blush-200 text-blush-700" : "border-blush-100 bg-paper text-ink-soft hover:text-ink"
  }`;

export function MemoriesPage() {
  // Los filtros viven en la URL: el botón "atrás" y los enlaces a una etiqueta funcionan solos.
  const [params, setParams] = useSearchParams();
  const view: View = params.get("vista") === "linea" ? "linea" : "tarjetas";
  const category = params.get("categoria") ?? undefined;
  const tag = params.get("etiqueta") ?? undefined;
  const favorites = params.get("favoritos") === "1";

  const [query, setQuery] = useState(params.get("q") ?? "");
  const debouncedQuery = useDebouncedValue(query.trim());
  const [filters, setFilters] = useState<MemoryFilters>({ categories: [], tags: [] });

  const pending = useOutbox("memory.create");
  const list = useMemoryList({ q: debouncedQuery || undefined, category, tag, favorites, limit: 30 });

  useEffect(() => {
    memoriesApi.filters().then(setFilters).catch(() => undefined);
  }, []);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [name, value] of Object.entries(changes)) {
      if (value === null) next.delete(name);
      else next.set(name, value);
    }
    setParams(next, { replace: true });
  };

  const anyFilter = Boolean(debouncedQuery || category || tag || favorites);

  return (
    <section>
      <header className="mb-4 flex animate-fade-up items-center justify-between gap-3">
        <h1 className="text-3xl">Recuerdos</h1>
        <div className="flex rounded-full border border-blush-100 bg-paper p-1" role="group" aria-label="Vista">
          {(
            [
              ["tarjetas", LayoutGrid, "Tarjetas"],
              ["linea", GitCommitVertical, "Cronológica"],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              aria-label={label}
              onClick={() => update({ vista: value === "tarjetas" ? null : value })}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                view === value ? "bg-blush-50 text-blush-500" : "text-ink-soft"
              }`}
            >
              <Icon size={18} aria-hidden />
            </button>
          ))}
        </div>
      </header>

      <label className="relative mb-3 block animate-fade-up [animation-delay:40ms]">
        <span className="sr-only">Buscar recuerdos</span>
        <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            update({ q: event.target.value.trim() || null });
          }}
          placeholder="Buscar por título, lugar o etiqueta"
          className="w-full rounded-2xl border border-transparent bg-blush-50 py-3 pr-4 pl-11 text-ink outline-none placeholder:text-ink-soft/70 focus:border-blush-200 focus:bg-paper"
        />
      </label>

      <Link
        to={`/recuerdos/preguntar${debouncedQuery ? `?p=${encodeURIComponent(debouncedQuery)}` : ""}`}
        className="mb-3 flex animate-fade-up items-center gap-2 rounded-full bg-gradient-to-r from-blush-100 to-lavender-100 px-4 py-2.5 text-sm font-bold text-lavender-500 [animation-delay:60ms]"
      >
        <Sparkles size={16} className="text-lavender-500" aria-hidden />
        <span className="flex-1 truncate">
          Pregúntale a sus recuerdos <span className="font-normal text-ink-soft">· con IA</span>
        </span>
      </Link>

      <div className="-mx-5 mb-5 flex animate-fade-up gap-2 overflow-x-auto px-5 pb-1 [animation-delay:80ms] [scrollbar-width:none]">
        <button type="button" className={chipClass(!category && !favorites)} onClick={() => update({ categoria: null, favoritos: null })}>
          Todos
        </button>
        <button type="button" className={chipClass(favorites)} onClick={() => update({ favoritos: favorites ? null : "1" })}>
          <Heart size={14} fill={favorites ? "currentColor" : "none"} aria-hidden /> Favoritos
        </button>
        {filters.categories.map((name) => (
          <button
            key={name}
            type="button"
            className={chipClass(category === name)}
            onClick={() => update({ categoria: category === name ? null : name })}
          >
            {name}
          </button>
        ))}
      </div>

      {tag && (
        <button type="button" onClick={() => update({ etiqueta: null })} className="mb-4 flex items-center gap-1.5 rounded-full bg-lavender-100 px-3 py-1.5 text-sm font-semibold text-lavender-500">
          #{tag} <X size={14} aria-label="Quitar etiqueta" />
        </button>
      )}

      {!anyFilter && (
        <PendingList
          type="memory.create"
          describe={(action) => formatLongDate(action.payload.input.happenedOn)}
        />
      )}

      {list.status === "loading" && (
        <div className="space-y-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      )}

      {list.status === "error" && (
        <Card className="text-center">
          <p className="text-ink-soft">{list.error}</p>
          <Button variant="secondary" className="mt-4" onClick={list.reload}>
            Reintentar
          </Button>
        </Card>
      )}

      {(list.status === "ready" || list.status === "loading-more") && list.items.length === 0 && (anyFilter || pending.length === 0) && (
        <Card className="animate-fade-up px-6 py-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blush-50 text-blush-500">
            <Camera size={26} strokeWidth={1.75} aria-hidden />
          </span>
          <p className="mt-4 font-display text-xl">{anyFilter ? "Nada por aquí" : "Su primer recuerdo"}</p>
          <p className="mx-auto mt-2 max-w-xs text-ink-soft">
            {anyFilter ? "Prueba con otra búsqueda o quita los filtros." : "Guarden aquí ese momento que no quieren olvidar."}
          </p>
          {/* Una frase ("qué hicimos en…") no aparece escrita tal cual: la búsqueda con IA sí la entiende. */}
          {anyFilter && debouncedQuery.length >= 3 && (
            <Link
              to={`/recuerdos/preguntar?p=${encodeURIComponent(debouncedQuery)}&preguntar=1`}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-lavender-100 px-5 py-3 text-sm font-semibold text-ink"
            >
              <Sparkles size={16} className="text-lavender-500" aria-hidden /> Preguntarle a la IA
            </Link>
          )}
          {!anyFilter && (
            <Link to="/recuerdos/nuevo" className="mt-5 inline-flex items-center gap-2 rounded-full bg-pastel px-6 py-3 font-bold text-ink">
              <Plus size={18} aria-hidden /> Crear recuerdo
            </Link>
          )}
        </Card>
      )}

      {list.items.length > 0 && list.status !== "loading" && (
        <>
          {view === "tarjetas" ? (
            <ul className="columns-2 gap-3">
              {list.items.map((memory) => (
                <li key={memory.id} className="mb-3 animate-fade-up break-inside-avoid">
                  <MemoryCard memory={memory} />
                </li>
              ))}
            </ul>
          ) : (
            <MemoryTimeline memories={list.items} />
          )}
          {list.hasMore && (
            <div className="mt-6 text-center">
              <Button variant="secondary" onClick={list.loadMore} disabled={list.status === "loading-more"}>
                {list.status === "loading-more" ? "Cargando…" : "Ver más recuerdos"}
              </Button>
            </div>
          )}
        </>
      )}

      <Link
        to="/recuerdos/nuevo"
        aria-label="Nuevo recuerdo"
        className="fixed right-5 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-10 flex h-14 w-14 items-center justify-center rounded-[1.15rem] bg-pastel text-white shadow-[0_12px_24px_-10px_rgb(208_85_122/0.8)] transition hover:brightness-105 active:scale-95 lg:right-[calc(50%-15rem)]"
      >
        <Plus size={26} aria-hidden />
      </Link>
    </section>
  );
}
