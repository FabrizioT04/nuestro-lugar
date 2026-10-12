import { useState } from "react";
import { Link } from "react-router";
import { ChevronRight, LogOut, Sparkles } from "lucide-react";
import { useMe } from "@/auth/AuthContext";
import { LOGOUT_URL } from "@/auth/session";
import { InstallCard } from "@/components/InstallCard";
import { PageHeader } from "@/components/PageHeader";
import { SyncSection } from "@/components/sync/SyncSection";
import { useOutbox } from "@/hooks/useOutbox";
import { clearOfflineData } from "@/offline/cache";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatLongDate } from "@/utils/format";

export function ProfilePage() {
  const me = useMe();
  const partner = me.relationship?.members.find((member) => member.id !== me.user.id);
  const pending = useOutbox().length;
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Al salir se borra todo lo guardado en el dispositivo (copias, cola y fotos sin subir).
  async function logout() {
    if (pending > 0 && !confirmLogout) {
      setConfirmLogout(true);
      return;
    }
    await clearOfflineData().catch(() => undefined);
    window.location.href = LOGOUT_URL;
  }

  return (
    <section className="space-y-4">
      <PageHeader title="Perfil" />

      <Card className="flex animate-fade-up items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blush-100 font-display text-2xl text-blush-700">
          {me.user.displayName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{me.user.displayName}</p>
          <p className="truncate text-sm text-ink-soft">{me.user.email}</p>
        </div>
      </Card>

      {me.relationship && (
        <Card className="animate-fade-up text-sm [animation-delay:60ms]">
          <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Nuestro lugar</p>
          <dl className="mt-2 space-y-1">
            {partner && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Con</dt>
                <dd className="font-semibold">{partner.displayName}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Juntos desde</dt>
              <dd className="font-semibold">{formatLongDate(me.relationship.startedOn)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Zona horaria</dt>
              <dd className="font-semibold">{me.relationship.timezone}</dd>
            </div>
          </dl>
        </Card>
      )}

      <Link to="/bienvenida" className="block animate-fade-up [animation-delay:120ms]">
        <Card className="flex items-center gap-3">
          <Sparkles size={20} className="text-lavender-500" aria-hidden />
          <span className="flex-1 font-semibold">Ver la introducción otra vez</span>
          <ChevronRight size={20} className="text-ink-soft" aria-hidden />
        </Card>
      </Link>

      <SyncSection />

      <InstallCard />

      {confirmLogout && (
        <p role="alert" className="rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-700">
          {pending === 1 ? "Hay 1 cambio" : `Hay ${pending} cambios`} sin sincronizar. Si cierras sesión ahora se perderán. Toca otra vez para salir igualmente.
        </p>
      )}

      <Button variant="secondary" className="w-full" onClick={() => void logout()}>
        <LogOut size={18} aria-hidden />
        {confirmLogout ? "Cerrar sesión igualmente" : "Cerrar sesión"}
      </Button>
    </section>
  );
}
