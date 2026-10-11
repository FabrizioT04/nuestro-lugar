import { Card } from "@/components/ui/Card";
import { LOGOUT_URL } from "@/auth/session";

export function AccessDeniedPage({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
      <Card className="w-full text-center">
        <p className="text-3xl" aria-hidden>
          🔒
        </p>
        <h1 className="mt-2 text-2xl">{message}</h1>
        <p className="mt-2 text-ink-soft">Esta cuenta no tiene acceso. Si te equivocaste de cuenta, cierra sesión y entra con la correcta.</p>
        <a
          href={LOGOUT_URL}
          className="mt-5 inline-block rounded-full bg-blush-300 px-6 py-3 font-semibold text-ink transition hover:bg-blush-200"
        >
          Cerrar sesión
        </a>
      </Card>
    </main>
  );
}
