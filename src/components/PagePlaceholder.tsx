import type { LucideIcon } from "lucide-react";
import { Card } from "./ui/Card";
import { PageHeader } from "./PageHeader";

interface Props {
  title: string;
  icon: LucideIcon;
  description: string;
}

/** Pantalla temporal para módulos que se construyen en fases posteriores. */
export function PagePlaceholder({ title, icon: Icon, description }: Props) {
  return (
    <section>
      <PageHeader title={title} />
      <Card className="animate-fade-up px-6 py-10 text-center [animation-delay:80ms]">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blush-50 text-blush-500">
          <Icon size={26} strokeWidth={1.75} aria-hidden />
        </span>
        <p className="mt-4 font-display text-xl">Muy pronto</p>
        <p className="mx-auto mt-2 max-w-xs text-ink-soft">{description}</p>
      </Card>
    </section>
  );
}
