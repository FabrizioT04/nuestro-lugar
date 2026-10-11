import { Card } from "./ui/Card";

interface Props {
  title: string;
  emoji: string;
  phase: number;
}

/** Pantalla temporal para rutas cuyo módulo se construye en una fase posterior. */
export function PagePlaceholder({ title, emoji, phase }: Props) {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl text-ink">{title}</h1>
      <Card className="text-center">
        <p className="text-4xl" aria-hidden>
          {emoji}
        </p>
        <p className="mt-3 text-ink-soft">Este rincón se construye en la Fase {phase}.</p>
      </Card>
    </section>
  );
}
