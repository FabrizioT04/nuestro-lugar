import { PagePlaceholder } from "@/components/PagePlaceholder";

/** Introducción romántica (una vez por usuario). Ruta fuera del layout con navegación. */
export function IntroPage() {
  return (
    <main className="mx-auto max-w-lg px-4 pt-10">
      <PagePlaceholder title="Bienvenida" emoji="✨" phase={3} />
    </main>
  );
}
