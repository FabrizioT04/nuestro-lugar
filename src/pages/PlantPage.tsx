import { useEffect, useState } from "react";
import { Check, Droplet, Droplets, Pencil } from "lucide-react";
import type { PlantResponse } from "@shared/api";
import { PLANT_STAGES } from "@shared/plant";
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
  const thirsty = plant.mood !== "happy" && plant.careDays > 0;

  return (
    <>
      <header className="mb-4 flex animate-fade-up items-center gap-2">
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

      {/* La escena: la maceta en una repisa con luz de ventana. */}
      <div className="relative animate-fade-up overflow-hidden rounded-[28px] bg-gradient-to-b from-lavender-100 via-blush-50 to-cream [animation-delay:60ms]">
        <div aria-hidden className="absolute top-10 left-1/2 size-56 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,#fff6e6_0%,#fff6e600_70%)]" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[13%] bg-gradient-to-b from-[#ecdcd3] to-[#e2cdc2]" />
        <div className="relative flex items-start justify-between p-4">
          <span className="rounded-full bg-paper/80 px-3 py-1 text-xs font-medium text-ink shadow-sm backdrop-blur">
            {plant.stage.name} · {plant.stage.index + 1} de {PLANT_STAGES.length}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-medium shadow-sm backdrop-blur ${thirsty ? "bg-[#fdf1e4]/90 text-[#9a5a1c]" : "bg-sage-100/90 text-sage-700"}`}>
            {thirsty ? "Con sed" : plant.careDays === 0 ? "Recién sembrada" : "Feliz"}
          </span>
        </div>
        <div className="relative -mt-8 px-6">
          <PlantArt plant={plant} watering={watering} />
        </div>
      </div>

      <div className="mt-4 animate-fade-up text-center [animation-delay:100ms]">
        <p className="text-lg font-medium text-ink">{moodText(plant)}</p>
        <Button className="mt-4 w-full" onClick={() => void water()} disabled={busy || plant.wateredToday.me}>
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
      </div>

      <Card className="mt-4 animate-fade-up [animation-delay:140ms]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base">Hoy</h2>
          {together && <span className="text-xs font-medium text-blush-700">La regaron los dos 💞</span>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <WaterChip done={plant.wateredToday.me} label="Tú" />
          <WaterChip done={plant.wateredToday.partner} label={plant.partnerName} />
        </div>
      </Card>

      <Card className="mt-4 animate-fade-up [animation-delay:180ms]">
        <h2 className="text-base">Cómo va creciendo</h2>
        <StageTrack current={plant.stage.index} />
        <p className="mt-3 text-sm text-ink-soft">{growthText(plant)}</p>
      </Card>
    </>
  );
}

function WaterChip({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${done ? "border-[#cfe3f2] bg-[#eef6fc]" : "border-blush-200 bg-cream"}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${done ? "bg-[#5b9bd0] text-paper" : "bg-blush-100 text-blush-300"}`}>
        <Droplet size={16} aria-hidden fill={done ? "currentColor" : "none"} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-soft">{done ? "Ya la regó" : "Todavía no"}</span>
      </span>
    </div>
  );
}

/** Las siete etapas como puntitos en una línea; la actual resaltada. */
function StageTrack({ current }: { current: number }) {
  return (
    <ol className="mt-4 flex items-center" aria-label={`Etapa ${current + 1} de ${PLANT_STAGES.length}`}>
      {PLANT_STAGES.map((stage) => (
        <li key={stage.index} className="flex flex-1 items-center last:flex-none" aria-current={stage.index === current ? "step" : undefined}>
          <span
            title={stage.name}
            className={`block shrink-0 rounded-full ${stage.index === current ? "size-4 bg-blush-500 ring-4 ring-blush-100" : stage.index < current ? "size-2.5 bg-blush-300" : "size-2.5 bg-blush-100"}`}
          />
          {stage.index < PLANT_STAGES.length - 1 && <span className={`mx-1 h-0.5 flex-1 rounded ${stage.index < current ? "bg-blush-300" : "bg-blush-100"}`} />}
        </li>
      ))}
    </ol>
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
