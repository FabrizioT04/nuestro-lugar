import { CoverArt } from "./CoverArt";

interface Props {
  /** URL de la foto. Sin ella se muestra la ilustración (las fotos reales llegan con R2 en la Fase 4). */
  src?: string;
  alt?: string;
  tilt?: number;
  className?: string;
}

export function Polaroid({ src, alt = "", tilt = 0, className = "" }: Props) {
  return (
    <figure
      className={`animate-float rounded-2xl bg-white p-2.5 pb-9 shadow-soft ${className}`}
      style={{ "--tilt": `${tilt}deg`, transform: `rotate(${tilt}deg)` } as React.CSSProperties}
    >
      {src ? (
        <img src={src} alt={alt} className="aspect-square w-full rounded-xl object-cover" />
      ) : (
        <CoverArt className="aspect-square w-full rounded-xl" />
      )}
    </figure>
  );
}
