import { useState, type FormEvent } from "react";
import { relationshipSetupSchema } from "@shared/schemas";
import { useAuth, useMe } from "@/auth/AuthContext";
import { Card } from "@/components/ui/Card";
import { ApiError } from "@/services/api/client";
import { meApi } from "@/services/api/me";

const today = () => new Date().toISOString().slice(0, 10);
const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Configuración inicial: la completa quien entre primero, una sola vez, para los dos. */
export function SetupPage() {
  const me = useMe();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = relationshipSetupSchema.safeParse({
      myName: form.get("myName"),
      partnerName: form.get("partnerName"),
      startedOn: form.get("startedOn"),
      timezone: form.get("timezone"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await meApi.setupRelationship(parsed.data);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === "conflict") {
        await refresh();
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-2xl border border-blush-100 bg-cream px-4 py-3 text-ink outline-none focus:border-blush-300 focus:ring-2 focus:ring-blush-100";

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-3xl">Antes de empezar</h1>
      <p className="mt-2 text-ink-soft">Solo una vez, y sirve para los dos.</p>

      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <label className="block">
            <span className="text-sm font-semibold">Tu nombre</span>
            <input name="myName" required maxLength={60} defaultValue={me.user.displayName} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Nombre de tu pareja</span>
            <input name="partnerName" required maxLength={60} className={inputClass} />
            {me.partnerEmail && <span className="mt-1 block text-xs text-ink-soft">Entrará con {me.partnerEmail}</span>}
          </label>
          <label className="block">
            <span className="text-sm font-semibold">¿Desde cuándo están juntos?</span>
            <input name="startedOn" type="date" required max={today()} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Zona horaria</span>
            <input name="timezone" required defaultValue={browserTimezone()} className={inputClass} />
            <span className="mt-1 block text-xs text-ink-soft">Decide cuándo se abren las cartas y cápsulas.</span>
          </label>

          {error && (
            <p role="alert" className="rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-blush-300 px-6 py-3 font-semibold text-ink transition hover:bg-blush-200 disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Crear nuestro lugar"}
          </button>
        </form>
      </Card>
    </main>
  );
}
