import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import type { PushPreferences } from "@shared/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAsync } from "@/hooks/useAsync";
import { currentSubscription, disablePush, enablePush, PushError, pushSupport } from "@/pwa/push";
import { pushApi } from "@/services/api/push";

const OPTIONS: { key: keyof PushPreferences; label: string; hint: string }[] = [
  { key: "letters", label: "Cartas", hint: "Carta nueva y cuando una carta programada ya se puede abrir" },
  { key: "memories", label: "Recuerdos", hint: "Cuando la otra persona guarda un recuerdo" },
  { key: "capsules", label: "Cápsulas del tiempo", hint: "Cápsula nueva y cuando ya se puede abrir" },
  { key: "dates", label: "Fechas especiales", hint: "Aniversario, mesiversario, cumpleaños y fechas (hoy y mañana)" },
  { key: "plans", label: "Planes", hint: "La mañana del día de un plan" },
  { key: "drawings", label: "Dibujos", hint: "Cuando la otra persona te deja un dibujo" },
  { key: "songs", label: "Canciones", hint: "Cuando te recomiendan una canción o les encanta la tuya" },
];

const ERRORS: Record<PushError["reason"], string> = {
  denied: "El navegador tiene los avisos bloqueados para esta app. Actívalos en los ajustes del sitio y vuelve a intentarlo.",
  "no-service-worker": "Abre la app instalada (o recarga la página) y vuelve a intentarlo.",
  "server-disabled": "Los avisos todavía no están activados en el servidor.",
};

/** Avisos en este dispositivo (Perfil). */
export function NotificationsCard() {
  const support = pushSupport();
  const config = useAsync(() => pushApi.config());
  const data = config.status === "success" ? config.data : null;
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [preferences, setPreferences] = useState<PushPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (support !== "supported") return;
    void currentSubscription()
      .then((sub) => setSubscribed(sub !== null && Notification.permission === "granted"))
      .catch(() => setSubscribed(false));
  }, [support]);

  useEffect(() => {
    if (data) setPreferences(data.preferences);
  }, [data]);

  if (support === "native") {
    return (
      <Card className="text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <BellOff size={18} className="text-ink-soft" aria-hidden /> Avisos
        </p>
        <p className="mt-1 text-ink-soft">Los avisos llegan en la versión web instalada (Chrome). Esta app de Android todavía no los recibe.</p>
      </Card>
    );
  }

  if (support === "ios-needs-install" || support === "unsupported") {
    return (
      <Card className="text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <BellOff size={18} className="text-ink-soft" aria-hidden /> Avisos
        </p>
        <p className="mt-1 text-ink-soft">
          {support === "ios-needs-install"
            ? "En iPhone, primero añade Nuestro Lugar a la pantalla de inicio y ábrelo desde ahí; luego actívalos aquí."
            : "Este navegador no permite avisos. Prueba con Chrome, Edge, Firefox o Safari."}
        </p>
      </Card>
    );
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await task();
    } catch (err) {
      setMessage(err instanceof PushError ? ERRORS[err.reason] : "No se pudo. Revisa tu conexión e inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  }

  const enable = () =>
    run(async () => {
      await enablePush(data?.publicKey ?? null);
      setSubscribed(true);
    });

  const disable = () =>
    run(async () => {
      await disablePush();
      setSubscribed(false);
    });

  const test = () =>
    run(async () => {
      const sub = await currentSubscription();
      if (!sub) throw new Error("sin suscripción");
      const { delivered } = await pushApi.test(sub.endpoint);
      setMessage(delivered ? "Listo: debería llegarte un aviso en unos segundos." : "El servicio de avisos no lo aceptó. Desactívalos y vuelve a activarlos.");
    });

  async function toggle(key: keyof PushPreferences) {
    if (!preferences) return;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    try {
      setPreferences(await pushApi.setPreferences(next));
    } catch {
      setPreferences(preferences);
      setMessage("No se pudo guardar. Revisa tu conexión.");
    }
  }

  const serverOff = data?.enabled === false;

  return (
    <Card className="space-y-3 text-sm">
      <div className="flex items-center gap-3">
        {subscribed ? <BellRing size={20} className="text-blush-500" aria-hidden /> : <Bell size={20} className="text-blush-500" aria-hidden />}
        <div className="flex-1">
          <p className="font-semibold">Avisos en este teléfono</p>
          <p className="text-ink-soft">
            {serverOff ? "Todavía no están activados en el servidor." : subscribed ? "Activados." : "Cartas, recuerdos, fechas y planes, aunque la app esté cerrada."}
          </p>
        </div>
      </div>

      {!serverOff && subscribed === false && (
        <Button className="w-full" onClick={() => void enable()} disabled={busy || !data}>
          Activar avisos
        </Button>
      )}

      {subscribed && preferences && (
        <fieldset className="space-y-1" disabled={busy}>
          <legend className="sr-only">Qué avisos quiero</legend>
          {OPTIONS.map((option) => (
            <label key={option.key} className="flex cursor-pointer items-center gap-3 rounded-2xl px-1 py-2">
              <span className="flex-1">
                <span className="block font-semibold">{option.label}</span>
                <span className="block text-xs text-ink-soft">{option.hint}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                className="h-5 w-5 accent-blush-500"
                checked={preferences[option.key]}
                onChange={() => void toggle(option.key)}
              />
            </label>
          ))}
          <p className="px-1 pt-1 text-xs text-ink-soft">Valen para todos tus dispositivos.</p>
        </fieldset>
      )}

      {subscribed && (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1 px-3" onClick={() => void test()} disabled={busy}>
            Probar
          </Button>
          <Button variant="ghost" className="flex-1 px-3" onClick={() => void disable()} disabled={busy}>
            Desactivar aquí
          </Button>
        </div>
      )}

      {message && (
        <p role="status" className="rounded-2xl bg-blush-50 px-3 py-2 text-blush-700">
          {message}
        </p>
      )}
    </Card>
  );
}
