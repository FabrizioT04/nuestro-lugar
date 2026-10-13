interface Props {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: Props) {
  return (
    <header className="mb-6 animate-fade-up">
      <h1 className="text-3xl text-ink">{title}</h1>
      {subtitle && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{subtitle}</p>}
    </header>
  );
}
