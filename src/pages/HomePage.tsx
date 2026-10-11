import { useMe } from "@/auth/AuthContext";
import { Card } from "@/components/ui/Card";
import { useSystemStatus } from "@/hooks/useSystemStatus";

export function HomePage() {
  const status = useSystemStatus();
  const me = useMe();
  const names = me.relationship?.members.map((m) => m.displayName).join(" & ");

  return (
    <section className="space-y-5">
      <header>
        <p className="text-sm font-semibold tracking-wide text-blush-500 uppercase">Fase 2</p>
        <h1 className="text-4xl text-ink">Nuestro Lugar</h1>
        <p className="mt-1 text-ink-soft">Hola, {me.user.displayName}. {names}</p>
      </header>

      <Card>
        <h2 className="text-xl">Estado del sistema</h2>
        {status.state === "loading" && <p className="mt-2 text-ink-soft">Comprobando…</p>}
        {status.state === "error" && (
          <p className="mt-2 text-blush-700" role="alert">
            No se pudo conectar: {status.message}
          </p>
        )}
        {status.state === "ok" && (
          <ul className="mt-3 space-y-1 text-sm">
            <li>✓ React → Worker ({status.api.environment})</li>
            <li>
              ✓ Worker → D1 ({status.db.tables} tablas, {status.db.latencyMs} ms)
            </li>
          </ul>
        )}
      </Card>
    </section>
  );
}
