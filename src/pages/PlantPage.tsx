import { useEffect, useState } from "react";
import { Check, Droplets, Pencil } from "lucide-react";
import type { PlantResponse } from "@shared/api";
import { PlantArt } from "@/components/plant/PlantArt";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { clearHomeBadge } from "@/hooks/useMarkSeen";
import { plantApi } from "@/services/api/plant";
import { plural } from "@/utils/format";

const loadPlant = () => plantApi.get();

/** La plantita de los dos: crece con cada día que alguien la riega. */
export function PlantPage() {
  const loaded = useAsync(loadPlant, { cacheKey: "plant" });
  const [plant, setPlant] = useState<PlantResponse | null>(null);
  // Solo cuando llega una respuesta nueva: después de regar manda lo que devolvió el riego.
  const data = loaded.status === "success" ? loaded.data : null;
  useEffect(() => {
    if (data) setPlant(data);
  }, [data]);

  return (
    <section>
      {loaded.status === "loading" && !plant && <Skeleton className="h-96" />}
      {loaded.status === "error" && !plant && (
        <Card className="text-center">
          <p className="text-ink-soft">{loaded.message}</p>
          <Button variant="secondary" className="mt-4" onClick={loaded.reload}>
            Reintentar
          </Button>
        </Card>
      )}
      {plant && <PlantView plant={plant} onChange={setPlant} />}
    </section>
  );
}

function PlantView({ plant, onChange }: { plant: PlantResponse; onChange: (plant: PlantResponse) => void }) {
  const [watering, setWatering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function water() {
    setBusy(true);
    setError(null);
    setWatering(true);
    try {
      onChange(await plantApi.water());
      void clearHomeBadge("plant");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo regar");
    } finally {
      setBusy(false);
      window.setTimeout(() => setWatering(false), 1400);
    }
  }

  const together = plant.wateredToday.me && plant.wateredToday.partner;

  return (
    <>
      <header className="mb-1 flex animate-fade-up items-center gap-2">
        {editing ? (
          <RenameForm
            name={plant.name}
            onDone={(updated) => {
              if (updated) onChange(updated);
              setEditing(false);
            }}
          />
        ) : (
          <>
            <h1 className="text-3xl">{plant.name}</h1>
            <button type="button" onClick={() => setEditing(true)} aria-label="Cambiar nombre" className="rounded-full p-2 text-ink-soft hover:bg-blush-50 hover:text-ink">
              <Pencil size={16} aria-hidden />
            </button>
          </>
        )}
      </header>
      <p className="mb-4 animate-fade-up text-sm text-ink-soft [animation-delay:40ms]">
        Crece un poquito cada día que alguno de los dos la riega.
      </p>

      <Card className="animate-fade-up text-center [animation-delay:80ms]">
        <p className="text-xs font-medium tracking-[0.14em] text-ink-soft uppercase">{plant.stage.name}</p>
        <PlantArt plant={plant} watering={watering} />
        <p className="mt-1 text-lg font-medium text-ink">{moodText(plant)}</p>
        <p className="mt-1 text-sm text-ink-soft">{growthText(plant)}</p>

        <Button className="mt-5 w-full" onClick={() => void water()} disabled={busy || plant.wateredToday.me}>
          {plant.wateredToday.me ? (
            <>
              <Check size={18} aria-hidden /> Ya la regaste hoy
            </>
          ) : (
            <>
              <Droplets size={18} aria-hidden /> {busy ? "Regando…" : "Regarla"}
            </>
          )}
        </Button>
        {error && <p className="mt-3 text-sm text-blush-700">{error}</p>}
      </Card>

      <Card className="mt-4 animate-fade-up [animation-delay:120ms]">
        <h2 className="text-base">Hoy</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <WaterRow done={plant.wateredToday.me} label="Tú" />
          <WaterRow done={plant.wateredToday.partner} label={plant.partnerName} />
        </ul>
        {together && <p className="mt-3 text-sm text-blush-700">Hoy la regaron los dos 💞</p>}
      </Card>
    </>
  );
}

function WaterRow({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-ink">{label}</span>
      <span className={done ? "font-medium text-[#3f7d63]" : "text-ink-soft"}>{done ? "La regó 💧" : "Todavía no"}</span>
    </li>
  );
}

function RenameForm({ name, onDone }: { name: string; onDone: (plant: PlantResponse | null) => void }) {
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (value.trim() === name) return onDone(null);
    setSaving(true);
    try {
      onDone(await plantApi.rename(value));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="flex gap-2">
        <input className="nl-input mt-0" aria-label="Nombre de la plantita" maxLength={40} value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
        <Button type="submit" disabled={saving || value.trim() === ""}>
          Guardar
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-blush-700">{error}</p>}
    </form>
  );
}

export function moodText(plant: Pick<PlantResponse, "mood" | "careDays" | "daysSinceWater">): string {
  if (plant.careDays === 0) return "Recién sembrada. ¡Riégala para que brote!";
  if (plant.mood === "very_thirsty") return `Tiene mucha sed: lleva ${plural(plant.daysSinceWater ?? 0, "día")} sin agua`;
  if (plant.mood === "thirsty") return "Tiene un poquito de sed";
  return "Está feliz";
}

export function growthText(plant: Pick<PlantResponse, "careDays" | "daysToNextStage" | "flowers">): string {
  const care = plural(plant.careDays, "día", "días");
  if (plant.daysToNextStage === null) return `${care} de cuidado · ${plural(plant.flowers, "flor", "flores")}`;
  return `${care} de cuidado · le ${plant.daysToNextStage === 1 ? "falta" : "faltan"} ${plural(plant.daysToNextStage, "día")} para crecer más`;
}
