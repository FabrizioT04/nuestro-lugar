import { useEffect, useState } from "react";
import type { PlacePreferences } from "@shared/api";
import {
  AMBIENCES,
  BUDGET_LABELS,
  DISTANCE_OPTIONS_KM,
  PLACE_CATEGORIES,
  PLACE_CATEGORY_INFO,
  type PlaceCategory,
} from "@shared/places";
import { DIETARY_OPTIONS } from "@shared/schemas";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { placesApi } from "@/services/api/places";
import { chipClass } from "./chips";

type Taste = "like" | "dislike" | null;

const tasteOf = (prefs: PlacePreferences, category: PlaceCategory): Taste =>
  prefs.likedCategories.includes(category) ? "like" : prefs.dislikedCategories.includes(category) ? "dislike" : null;

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

/** "Nuestros gustos": lo mío se edita; lo de mi pareja solo se ve. */
export function PreferencesPanel() {
  const data = useAsync(placesApi.preferences, { cacheKey: "places.preferences" });
  const [prefs, setPrefs] = useState<PlacePreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loaded = data.status === "success" ? data.data.mine : null;
  useEffect(() => {
    if (loaded) setPrefs(loaded);
  }, [loaded]);

  if (data.status === "loading" || (data.status === "success" && !prefs)) return <Skeleton className="h-64" />;
  if (data.status === "error") {
    return (
      <Card className="text-center">
        <p className="text-ink-soft">{data.message}</p>
        <Button variant="secondary" className="mt-4" onClick={data.reload}>
          Reintentar
        </Button>
      </Card>
    );
  }
  const current = prefs!;
  const partner = data.data.partner;

  function cycle(category: PlaceCategory) {
    const taste = tasteOf(current, category);
    const next: Taste = taste === null ? "like" : taste === "like" ? "dislike" : null;
    setPrefs({
      ...current,
      likedCategories: next === "like" ? [...current.likedCategories, category] : current.likedCategories.filter((c) => c !== category),
      dislikedCategories: next === "dislike" ? [...current.dislikedCategories, category] : current.dislikedCategories.filter((c) => c !== category),
    });
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await placesApi.savePreferences(current);
      setPrefs(saved.mine);
      setMessage("Guardado ♡");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const update = (changes: Partial<PlacePreferences>) => {
    setPrefs({ ...current, ...changes });
    setMessage(null);
  };

  return (
    <div className="space-y-4">
      <Card className="animate-fade-up space-y-5">
        <div>
          <h2 className="font-display text-xl">Lo que me gusta</h2>
          <p className="mt-1 text-sm text-ink-soft">Toca una vez para 👍, otra para 👎 y otra para quitarlo.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLACE_CATEGORIES.map((category) => {
              const taste = tasteOf(current, category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => cycle(category)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition ${
                    taste === "like" ? "bg-blush-100 text-blush-700" : taste === "dislike" ? "bg-ink/10 text-ink-soft line-through" : "bg-cream text-ink-soft"
                  }`}
                >
                  <span aria-hidden>{PLACE_CATEGORY_INFO[category].emoji}</span> {PLACE_CATEGORY_INFO[category].label}
                  {taste && <span aria-label={taste === "like" ? "me gusta" : "no me gusta"}>{taste === "like" ? "👍" : "👎"}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Ambiente">
          {AMBIENCES.map((ambience) => (
            <button key={ambience} type="button" className={chipClass(current.ambience.includes(ambience))} onClick={() => update({ ambience: toggle(current.ambience, ambience) })}>
              {ambience}
            </button>
          ))}
        </Field>

        <Field label="Presupuesto máximo">
          <button type="button" className={chipClass(current.budgetMax === null)} onClick={() => update({ budgetMax: null })}>
            Sin tope
          </button>
          {([1, 2, 3, 4] as const).map((level) => (
            <button key={level} type="button" className={chipClass(current.budgetMax === level)} onClick={() => update({ budgetMax: level })}>
              {BUDGET_LABELS[level]}
            </button>
          ))}
        </Field>

        <Field label="Distancia habitual">
          {DISTANCE_OPTIONS_KM.map((km) => (
            <button key={km} type="button" className={chipClass(current.maxDistanceKm === km)} onClick={() => update({ maxDistanceKm: current.maxDistanceKm === km ? null : km })}>
              {km} km
            </button>
          ))}
        </Field>

        <Field label="Comida">
          {DIETARY_OPTIONS.map((option) => (
            <button key={option} type="button" className={chipClass(current.dietary.includes(option))} onClick={() => update({ dietary: toggle(current.dietary, option) })}>
              {option}
            </button>
          ))}
        </Field>

        <div className="flex items-center gap-3">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar mis gustos"}
          </Button>
          {message && (
            <p role="status" className="text-sm text-ink-soft">
              {message}
            </p>
          )}
        </div>
      </Card>

      {partner && (
        <Card className="animate-fade-up text-sm [animation-delay:60ms]">
          <h2 className="font-display text-xl">A {partner.displayName} le gusta</h2>
          <PartnerSummary prefs={partner.preferences} />
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function PartnerSummary({ prefs }: { prefs: PlacePreferences }) {
  const label = (category: PlaceCategory) => `${PLACE_CATEGORY_INFO[category].emoji} ${PLACE_CATEGORY_INFO[category].label}`;
  const rows = [
    ["Le gusta", prefs.likedCategories.map(label).join(", ")],
    ["No tanto", prefs.dislikedCategories.map(label).join(", ")],
    ["Ambiente", prefs.ambience.join(", ")],
    ["Presupuesto", prefs.budgetMax ? `hasta ${BUDGET_LABELS[prefs.budgetMax as 1 | 2 | 3 | 4]}` : ""],
    ["Comida", prefs.dietary.join(", ")],
  ].filter(([, value]) => value);
  if (rows.length === 0) return <p className="mt-2 text-ink-soft">Todavía no guardó sus gustos.</p>;
  return (
    <dl className="mt-2 space-y-1">
      {rows.map(([name, value]) => (
        <div key={name} className="flex gap-3">
          <dt className="w-24 shrink-0 text-ink-soft">{name}</dt>
          <dd className="font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
