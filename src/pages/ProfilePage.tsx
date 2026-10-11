import { useMe } from "@/auth/AuthContext";
import { LOGOUT_URL } from "@/auth/session";
import { Card } from "@/components/ui/Card";

export function ProfilePage() {
  const me = useMe();

  return (
    <section className="space-y-4">
      <h1 className="text-3xl">Perfil</h1>
      <Card>
        <p className="text-xl font-semibold">{me.user.displayName}</p>
        <p className="text-ink-soft">{me.user.email}</p>
      </Card>
      <a
        href={LOGOUT_URL}
        className="block rounded-full border border-blush-200 px-6 py-3 text-center font-semibold text-blush-700 transition hover:bg-blush-50"
      >
        Cerrar sesión
      </a>
    </section>
  );
}
