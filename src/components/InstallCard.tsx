import { Download, Share, SquarePlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { promptInstall, useInstallState } from "@/pwa/install";

/** Instalar Nuestro Lugar en la pantalla de inicio (se abre como una app, sin barra del navegador). */
export function InstallCard() {
  const state = useInstallState();
  if (state === "installed" || state === "unavailable") return null;

  if (state === "ios") {
    return (
      <Card className="text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Download size={18} className="text-blush-500" aria-hidden /> Añadir a la pantalla de inicio
        </p>
        <ol className="mt-2 space-y-1 text-ink-soft">
          <li className="flex items-center gap-1.5">
            1. En Safari toca <Share size={15} aria-label="Compartir" /> Compartir.
          </li>
          <li className="flex items-center gap-1.5">
            2. Elige <SquarePlus size={15} aria-hidden /> «Añadir a pantalla de inicio».
          </li>
        </ol>
      </Card>
    );
  }

  return (
    <button type="button" onClick={() => void promptInstall()} className="block w-full text-left">
      <Card className="flex items-center gap-3">
        <Download size={20} className="text-blush-500" aria-hidden />
        <span className="flex-1">
          <span className="block font-semibold">Instalar en este teléfono</span>
          <span className="block text-sm text-ink-soft">Se abre como una app y funciona sin conexión.</span>
        </span>
      </Card>
    </button>
  );
}
