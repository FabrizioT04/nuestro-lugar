import { Card } from "@/components/ui/Card";

interface Props {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

/** Pantalla centrada para estados de sesión: cargando, sesión terminada, error. */
export function AuthStatusPage({ title, description, action }: Props) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
      <Card className="w-full text-center">
        <p className="text-3xl" aria-hidden>
          ♡
        </p>
        <h1 className="mt-2 text-2xl">{title}</h1>
        {description && <p className="mt-2 text-ink-soft">{description}</p>}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-5 rounded-full bg-blush-300 px-6 py-3 font-semibold text-ink transition hover:bg-blush-200"
          >
            {action.label}
          </button>
        )}
      </Card>
    </main>
  );
}
