import type { CSSProperties } from "react";
import type { PhotoRef } from "@shared/api";
import { CoverArt } from "@/components/CoverArt";
import { photoUrl } from "@/services/api/media";

interface Props {
  photo: PhotoRef | null;
  size?: "full" | "thumb";
  alt?: string;
  className?: string;
  eager?: boolean;
  style?: CSSProperties;
}

/** Foto servida por el Worker; sin foto muestra la ilustración de la casa. */
export function MemoryPhoto({ photo, size = "thumb", alt = "", className = "", eager = false, style }: Props) {
  if (!photo) return <CoverArt className={className} style={style} />;
  return (
    <img
      src={photoUrl(photo, size)}
      alt={alt}
      width={photo.width ?? undefined}
      height={photo.height ?? undefined}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      style={style}
      className={`bg-blush-50 object-cover ${className}`}
    />
  );
}
