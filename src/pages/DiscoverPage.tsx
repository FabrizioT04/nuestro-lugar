import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { Compass, LocateFixed, MapPin, SlidersHorizontal, Sparkles, WifiOff } from "lucide-react";
import type { GeoPoint, PlaceIntent, PlaceRecommendationsResponse, PlaceStatus, SavedPlace } from "@shared/api";
import {
  AMBIENCES,
  BUDGET_LABELS,
  DISTANCE_OPTIONS_KM,
  PLACE_CATEGORIES,
  PLACE_CATEGORY_INFO,
  type Ambience,
  type PlaceCategory,
} from "@shared/places";
import type { PlaceSearchInput } from "@shared/schemas";
import { useMe } from "@/auth/AuthContext";
import { chipClass } from "@/components/places/chips";
import { GoogleAttribution, PlaceCard } from "@/components/places/PlaceCard";
import { PreferencesPanel } from "@/components/places/PreferencesPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getCurrentPosition, LocationError } from "@/platform/geolocation";
import { ApiError } from "@/services/api/client";
import { placesApi } from "@/services/api/places";

const TABS = [
  { param: null, label: "Buscar" },
  { param: "guardados", label: "Guardados" },
  { param: "gustos", label: "Gustos" },
] as const;

const tabClass = (active: boolean) =>
  `flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${active ? "bg-blush-100 text-blush-700" : "text-ink-soft hover:text-ink"}`;

const inputClass =
  "w-full rounded-2xl border border-blush-100 bg-cream px-4 py-3 text-ink outline-none focus:border-blush-300 focus:ring-2 focus:ring-blush-100";

const EXAMPLES = ["Un lugar tranquilo para comer algo dulce y conversar", "Algo barato al aire libre cerca", "Sushi abierto ahorita"];

/** Mensajes claros para los errores que puede devolver la búsqueda. */
function errorMessage(err: unknown): { title: string; detail: string } {
  if (err instanceof ApiError) {
    if (err.code === "network_error") return { title: "Sin conexión", detail: "Para buscar lugares hace falta Internet." };
    if (err.code === "service_unavailable") return { title: "Falta activar Google Maps", detail: `${err.message}. Revisa la clave GOOGLE_PLACES_API_KEY.` };
    if (err.code === "rate_limited") return { title: "Un respiro", detail: err.message };
    return { title: "No se pudo buscar", detail: err.message };
  }
  return { title: "No se pudo buscar", detail: "Inténtalo de nuevo." };
}

type Located = { point: GeoPoint; label: string };

export function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.param === params.get("vista")) ?? TABS[0];
  const [location, setLocation] = useState<Located | null>(null);

  const select = (param: string | null) => {
    const next = new URLSearchParams(params);
    if (param) next.set("vista", param);
    else next.delete("vista");
    setParams(next, { replace: true });
  };

  return (
    <section>
      <header className="mb-4 animate-fade-up">
        <h1 className="text-3xl">¿Qué hacemos hoy?</h1>
        <p className="mt-1 text-ink-soft">Ideas cerca de ustedes, pensadas para los dos.</p>
      </header>

      <div className="mb-4 flex animate-fade-up rounded-full bg-paper p-1 shadow-soft [animation-delay:40ms]" role="tablist" aria-label="Sección">
        {TABS.map((t) => (
          <button key={t.label} type="button" role="tab" aria-selected={tab === t} className={tabClass(tab === t)} onClick={() => select(t.param)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab.param === null && <SearchView location={location} onLocation={setLocation} />}
      {tab.param === "guardados" && <SavedView location={location} />}
      {tab.param === "gustos" && <PreferencesPanel />}
    </section>
  );
}

function usePartnerName() {
  const me = useMe();
  return me.relationship?.members.find((member) => member.id !== me.user.id)?.displayName ?? null;
}

// ---------------------------------------------------------------------------
// Ubicación: GPS del teléfono o, si no se puede, una zona escrita.
// ---------------------------------------------------------------------------

function LocationBar({ location, onLocation }: { location: Located | null; onLocation: (value: Located) => void }) {
  const [locating, setLocating] = useState(false);
  const [manual, setManual] = useState(false);
  const [zone, setZone] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function locate() {
    setLocating(true);
    setError(null);
    try {
      const position = await getCurrentPosition();
      setManual(false);
      // ~10 m de precisión es suficiente y no envía la ubicación exacta.
      const round = (value: number) => Math.round(value * 10000) / 10000;
      onLocation({ point: { lat: round(position.lat), lng: round(position.lng) }, label: "Tu ubicación" });
    } catch (err) {
      const reason = err instanceof LocationError ? err.reason : "unavailable";
      setManual(true);
      setError(
        reason === "unsupported"
          ? "Este dispositivo no comparte su ubicación. Escribe una zona."
          : reason === "denied"
            ? "No diste permiso de ubicación. Escribe una zona."
            : "No pudimos ubicarte. Escribe una zona.",
      );
    } finally {
      setLocating(false);
    }
  }

  async function searchZone(event: FormEvent) {
    event.preventDefault();
    if (zone.trim().length < 2) return;
    setLocating(true);
    setError(null);
    try {
      const result = await placesApi.geocode(zone.trim());
      onLocation({ point: result.location, label: result.label });
      setManual(false);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "not_found" ? "No encontramos esa zona." : errorMessage(err).detail);
    } finally {
      setLocating(false);
    }
  }

  return (
    <Card className="animate-fade-up [animation-delay:80ms]">
      <div className="flex items-center gap-3">
        <MapPin size={20} className="shrink-0 text-blush-500" aria-hidden />
        <p className="min-w-0 flex-1 truncate font-semibold">{location ? location.label : "¿Dónde están?"}</p>
        <button type="button" onClick={() => void locate()} disabled={locating} className="inline-flex items-center gap-1 text-sm font-semibold text-lavender-500 disabled:opacity-60">
          <LocateFixed size={16} aria-hidden /> {locating ? "Buscando…" : location ? "Actualizar" : "Usar mi ubicación"}
        </button>
      </div>
      {(manual || !location) && (
        <form onSubmit={(e) => void searchZone(e)} className="mt-3 flex gap-2">
          <input
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            maxLength={120}
            className={`${inputClass} py-2`}
            placeholder="o escribe una zona: Barranco, Lima"
            aria-label="Zona"
          />
          <Button type="submit" variant="secondary" className="px-4 py-2" disabled={locating || zone.trim().length < 2}>
            Ir
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-blush-700">
          {error}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Buscar
// ---------------------------------------------------------------------------

interface Filters {
  categories: PlaceCategory[];
  budget: number | null | undefined;
  maxDistanceKm: number | undefined;
  openNow: boolean | undefined;
  ambience: Ambience[];
}

const NO_FILTERS: Filters = { categories: [], budget: undefined, maxDistanceKm: undefined, openNow: undefined, ambience: [] };

function SearchView({ location, onLocation }: { location: Located | null; onLocation: (value: Located) => void }) {
  const online = useOnlineStatus();
  const partnerName = usePartnerName();
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<PlaceRecommendationsResponse | null>(null);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);

  const activeFilters =
    filters.categories.length + filters.ambience.length + Number(filters.budget !== undefined) + Number(filters.maxDistanceKm !== undefined) + Number(filters.openNow !== undefined);

  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (!location) return;
    setSearching(true);
    setError(null);
    const input: PlaceSearchInput = {
      location: location.point,
      ...(text.trim() ? { text: text.trim() } : {}),
      ...(filters.categories.length ? { categories: filters.categories } : {}),
      ...(filters.ambience.length ? { ambience: filters.ambience } : {}),
      ...(filters.budget !== undefined ? { budget: filters.budget } : {}),
      ...(filters.maxDistanceKm !== undefined ? { maxDistanceKm: filters.maxDistanceKm } : {}),
      ...(filters.openNow !== undefined ? { openNow: filters.openNow } : {}),
    };
    try {
      setResult(await placesApi.recommend(input));
    } catch (err) {
      setResult(null);
      setError(errorMessage(err));
    } finally {
      setSearching(false);
    }
  }

  const setStatus = (placeId: string, status: PlaceStatus) =>
    setResult((current) =>
      current && { ...current, items: current.items.map((item) => (item.place.id === placeId ? { ...item, status } : item)) },
    );
  const hide = (placeId: string) =>
    setResult((current) => current && { ...current, items: current.items.filter((item) => item.place.id !== placeId) });

  const toggleIn = <T,>(list: T[], value: T, max = Infinity) =>
    list.includes(value) ? list.filter((item) => item !== value) : list.length < max ? [...list, value] : list;

  return (
    <div className="space-y-4">
      {!online && (
        <p className="flex items-center gap-2 rounded-2xl bg-lavender-100 px-4 py-3 text-sm text-ink">
          <WifiOff size={16} aria-hidden /> Sin conexión: para buscar lugares hace falta Internet.
        </p>
      )}

      <LocationBar location={location} onLocation={onLocation} />

      <form onSubmit={(e) => void search(e)} className="animate-fade-up space-y-3 [animation-delay:120ms]">
        <Card className="space-y-3">
          <label htmlFor="discover-text" className="font-display text-xl">
            ¿Qué tienen ganas de hacer?
          </label>
          <textarea
            id="discover-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            rows={2}
            className={`${inputClass} resize-none`}
            placeholder={EXAMPLES[0]}
          />
          {!text && (
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
              {EXAMPLES.slice(1).map((example) => (
                <button key={example} type="button" className={chipClass(false)} onClick={() => setText(example)}>
                  {example}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-lavender-500"
          >
            <SlidersHorizontal size={16} aria-hidden /> Filtros{activeFilters > 0 && ` (${activeFilters})`}
          </button>

          {showFilters && (
            <div className="space-y-4 border-t border-blush-100 pt-4">
              <FilterRow label="Tipo de plan (hasta 4)">
                {PLACE_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={chipClass(filters.categories.includes(category))}
                    onClick={() => setFilters({ ...filters, categories: toggleIn(filters.categories, category, 4) })}
                  >
                    <span aria-hidden>{PLACE_CATEGORY_INFO[category].emoji}</span> {PLACE_CATEGORY_INFO[category].label}
                  </button>
                ))}
              </FilterRow>
              <FilterRow label="Presupuesto">
                {([1, 2, 3, 4] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={chipClass(filters.budget === level)}
                    onClick={() => setFilters({ ...filters, budget: filters.budget === level ? undefined : level })}
                  >
                    hasta {BUDGET_LABELS[level]}
                  </button>
                ))}
              </FilterRow>
              <FilterRow label="Distancia">
                {DISTANCE_OPTIONS_KM.map((km) => (
                  <button
                    key={km}
                    type="button"
                    className={chipClass(filters.maxDistanceKm === km)}
                    onClick={() => setFilters({ ...filters, maxDistanceKm: filters.maxDistanceKm === km ? undefined : km })}
                  >
                    {km} km
                  </button>
                ))}
              </FilterRow>
              <FilterRow label="Ambiente y horario">
                {AMBIENCES.map((ambience) => (
                  <button
                    key={ambience}
                    type="button"
                    className={chipClass(filters.ambience.includes(ambience))}
                    onClick={() => setFilters({ ...filters, ambience: toggleIn(filters.ambience, ambience) })}
                  >
                    {ambience}
                  </button>
                ))}
                <button
                  type="button"
                  className={chipClass(filters.openNow === true)}
                  onClick={() => setFilters({ ...filters, openNow: filters.openNow ? undefined : true })}
                >
                  Abierto ahora
                </button>
              </FilterRow>
              {activeFilters > 0 && (
                <button type="button" className="text-sm text-ink-soft underline" onClick={() => setFilters(NO_FILTERS)}>
                  Quitar filtros
                </button>
              )}
            </div>
          )}
        </Card>

        <Button type="submit" className="w-full" disabled={!location || searching || !online}>
          <Sparkles size={18} aria-hidden /> {searching ? "Buscando ideas…" : location ? "Buscar ideas" : "Primero dinos dónde están"}
        </Button>
      </form>

      {searching && (
        <div className="space-y-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      )}

      {error && !searching && (
        <Card className="text-center" role="alert">
          <p className="font-display text-xl">{error.title}</p>
          <p className="mt-1 text-ink-soft">{error.detail}</p>
        </Card>
      )}

      {result && !searching && (
        <div className="space-y-3">
          <Understood intent={result.understood} />
          {result.items.length === 0 ? (
            <Card className="px-6 py-10 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lavender-100 text-lavender-500">
                <Compass size={26} strokeWidth={1.75} aria-hidden />
              </span>
              <p className="mt-4 font-display text-xl">No encontramos nada así</p>
              <p className="mx-auto mt-2 max-w-xs text-ink-soft">Prueben con más distancia, otro tipo de plan o sin “abierto ahora”.</p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {result.items.map((item) => (
                <li key={item.place.id}>
                  <PlaceCard
                    placeId={item.place.id}
                    place={item.place}
                    category={item.place.category}
                    status={item.status}
                    reasons={item.reasons}
                    partnerName={partnerName}
                    onStatus={(status) => setStatus(item.place.id, status)}
                    onHide={() => hide(item.place.id)}
                  />
                </li>
              ))}
            </ul>
          )}
          <GoogleAttribution />
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** "Entendí: …" para que se vea qué se buscó y se pueda corregir con los filtros. */
function Understood({ intent }: { intent: PlaceIntent }) {
  const parts = [
    ...intent.categories.map((category) => `${PLACE_CATEGORY_INFO[category].emoji} ${PLACE_CATEGORY_INFO[category].label}`),
    ...(intent.food ? [intent.food] : []),
    ...intent.ambience,
    ...(intent.budget ? [`hasta ${BUDGET_LABELS[intent.budget as 1 | 2 | 3 | 4]}`] : []),
    `hasta ${String(intent.maxDistanceKm).replace(".", ",")} km`,
    ...(intent.openNow ? ["abierto ahora"] : []),
    ...intent.dietary,
  ];
  return (
    <p className="text-sm text-ink-soft">
      <span className="font-semibold text-ink">Entendí:</span> {parts.join(" · ")}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Guardados
// ---------------------------------------------------------------------------

function SavedView({ location }: { location: Located | null }) {
  const online = useOnlineStatus();
  const partnerName = usePartnerName();
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "success"; items: SavedPlace[] }>({
    status: "loading",
  });
  const point = location?.point ?? null;

  // Los datos de Google se piden cada vez (no se guardan en el dispositivo ni en D1).
  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const data = await placesApi.saved(point);
      setState({ status: "success", items: data.items });
    } catch (err) {
      setState({ status: "error", message: errorMessage(err).detail });
    }
  }, [point]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === "loading") return <Skeleton className="h-48" />;
  if (state.status === "error") {
    return (
      <Card className="text-center" role="alert">
        <p className="text-ink-soft">{state.message}</p>
        <Button variant="secondary" className="mt-4" onClick={() => void load()} disabled={!online}>
          Reintentar
        </Button>
      </Card>
    );
  }
  if (state.items.length === 0) {
    return (
      <Card className="px-6 py-10 text-center">
        <p className="font-display text-xl">Todavía nada guardado</p>
        <p className="mx-auto mt-2 max-w-xs text-ink-soft">Lo que marquen con 👀, ⭐, 📍 o 💖 aparece aquí.</p>
      </Card>
    );
  }

  const update = (placeId: string, status: PlaceStatus) =>
    setState((current) =>
      current.status === "success" ? { ...current, items: current.items.map((item) => (item.placeId === placeId ? { ...item, status } : item)) } : current,
    );

  return (
    <div>
      <ul className="space-y-3">
        {state.items.map((item) => (
          <li key={item.placeId}>
            <PlaceCard
              placeId={item.placeId}
              place={item.place}
              category={item.category}
              status={item.status}
              partnerName={partnerName}
              onStatus={(status) => update(item.placeId, status)}
            />
          </li>
        ))}
      </ul>
      <GoogleAttribution />
    </div>
  );
}
