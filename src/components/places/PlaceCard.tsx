import { useState } from "react";
import { Link } from "react-router";
import { CalendarPlus, ExternalLink, Star } from "lucide-react";
import type { PlaceStatus, PlaceSummary } from "@shared/api";
import {
  BUDGET_LABELS,
  conflictingWith,
  PLACE_CATEGORY_INFO,
  PLACE_INTERACTION_INFO,
  type PlaceCategory,
  type PlaceInteractionType,
} from "@shared/places";
import { Card } from "@/components/ui/Card";
import { ApiError } from "@/services/api/client";
import { placesApi } from "@/services/api/places";

/** Los botones que se ven siempre; "No me interesa" va aparte, más discreto. */
const MAIN_ACTIONS: PlaceInteractionType[] = ["interested", "favorite", "visited", "loved"];

/** Tipo de plan que corresponde a cada categoría, para "Guardar como plan". */
const PLAN_TYPE_FOR: Record<PlaceCategory, string> = {
  cafe: "date",
  dessert: "date",
  restaurant: "restaurant",
  bar: "date",
  park: "date",
  culture: "place_to_visit",
  cinema: "movie",
  viewpoint: "place_to_visit",
  activity: "activity",
};

interface Props {
  placeId: string;
  /** null si Google ya no tiene datos del lugar (solo en Guardados). */
  place: PlaceSummary | null;
  category: PlaceCategory | null;
  status: PlaceStatus;
  partnerName: string | null;
  reasons?: string[];
  onStatus: (status: PlaceStatus) => void;
  /** "No me interesa": la tarjeta desaparece de los resultados. */
  onHide?: () => void;
}

export function PlaceCard({ placeId, place, category, status, partnerName, reasons = [], onStatus, onHide }: Props) {
  const [busy, setBusy] = useState<PlaceInteractionType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const info = category ? PLACE_CATEGORY_INFO[category] : null;

  async function toggle(type: PlaceInteractionType) {
    const active = !status.mine.includes(type);
    const previous = status;
    // Al instante en pantalla; si falla, se deshace.
    const removed = active ? conflictingWith(type) : [type];
    const mine = [...status.mine.filter((t) => !removed.includes(t)), ...(active ? [type] : [])];
    onStatus({ ...status, mine });
    setBusy(type);
    setError(null);
    try {
      onStatus(await placesApi.setInteraction(placeId, type, active, category));
      if (type === "not_interested" && active) onHide?.();
    } catch (err) {
      onStatus(previous);
      setError(err instanceof ApiError && err.code === "network_error" ? "Sin conexión: no se guardó." : "No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  const planParams = new URLSearchParams({
    tipo: category ? PLAN_TYPE_FOR[category] : "date",
    titulo: place ? `Ir a ${place.name}` : "",
    lugar: place?.name ?? "",
  });

  return (
    <Card className="animate-fade-up">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lavender-100 text-xl" aria-hidden>
          {info?.emoji ?? "📍"}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl leading-tight">{place?.name ?? "Lugar no disponible"}</h3>
          {place ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
              {info && <span>{info.label}</span>}
              {place.rating !== null && (
                <span className="inline-flex items-center gap-0.5">
                  <Star size={13} className="fill-current text-blush-500" aria-hidden />
                  {place.rating.toFixed(1).replace(".", ",")}
                  {place.ratingCount !== null && <span className="opacity-70">({place.ratingCount})</span>}
                </span>
              )}
              {place.priceLevel !== null && <span>{place.priceLevel === 0 ? "Gratis" : BUDGET_LABELS[place.priceLevel as 1 | 2 | 3 | 4]}</span>}
              {place.openNow !== null && (
                <span className={place.openNow ? "font-semibold text-sage-700" : ""}>{place.openNow ? "Abierto" : "Cerrado ahora"}</span>
              )}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-ink-soft">Google ya no tiene datos de este lugar.</p>
          )}
          {place?.address && <p className="mt-0.5 truncate text-sm text-ink-soft">{place.address}</p>}
        </div>
      </div>

      {reasons.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Por qué lo recomendamos">
          {reasons.map((reason) => (
            <li key={reason} className="rounded-full bg-blush-50 px-2.5 py-1 text-xs font-semibold text-blush-700">
              {reason}
            </li>
          ))}
        </ul>
      )}

      {status.partner.length > 0 && partnerName && (
        <p className="mt-2 text-sm text-ink-soft">
          {partnerName}: {status.partner.map((type) => `${PLACE_INTERACTION_INFO[type].emoji} ${PLACE_INTERACTION_INFO[type].label}`).join(" · ")}
        </p>
      )}

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {MAIN_ACTIONS.map((type) => {
          const active = status.mine.includes(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={active}
              disabled={busy !== null}
              onClick={() => void toggle(type)}
              className={`flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-[11px] leading-tight font-semibold transition active:scale-95 disabled:opacity-70 ${
                active ? "bg-blush-300 text-ink" : "bg-cream text-ink-soft hover:text-ink"
              }`}
            >
              <span className="text-lg" aria-hidden>
                {PLACE_INTERACTION_INFO[type].emoji}
              </span>
              {PLACE_INTERACTION_INFO[type].label}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-blush-700">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {place?.mapsUrl && (
          <a href={place.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-lavender-500">
            <ExternalLink size={14} aria-hidden /> Ver en Google Maps
          </a>
        )}
        {place && (
          <Link to={`/planes/nuevo?${planParams.toString()}`} className="inline-flex items-center gap-1 font-semibold text-blush-700">
            <CalendarPlus size={14} aria-hidden /> Guardar como plan
          </Link>
        )}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void toggle("not_interested")}
          aria-pressed={status.mine.includes("not_interested")}
          className="ml-auto text-ink-soft underline-offset-2 hover:underline disabled:opacity-70"
        >
          {status.mine.includes("not_interested") ? "Volver a mostrar" : `${PLACE_INTERACTION_INFO.not_interested.emoji} No me interesa`}
        </button>
      </div>
    </Card>
  );
}

/** Atribución exigida por Google al mostrar datos de Places sin mapa. */
export function GoogleAttribution() {
  return (
    <p className="mt-4 text-center text-xs text-ink-soft" translate="no">
      Datos de lugares: <span className="font-semibold">Google Maps</span>
    </p>
  );
}
