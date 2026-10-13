import {
  CalendarHeart,
  Cake,
  Camera,
  Clapperboard,
  Coffee,
  Eye,
  EyeOff,
  Heart,
  HeartHandshake,
  IceCreamCone,
  Landmark,
  Lock,
  Mail,
  MapPin,
  Martini,
  Plane,
  Sparkles,
  Star,
  Sunset,
  Target,
  Ticket,
  Trees,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/** Tonos pastel para el fondo del ícono y su color. */
const TONES = {
  blush: "bg-blush-100 text-blush-500",
  lavender: "bg-lavender-100 text-lavender-500",
  mint: "bg-sage-100 text-sage-700",
  peach: "bg-[#ffeadf] text-[#c97a4a]",
  sky: "bg-[#e3eeff] text-[#5a7fc4]",
} as const;

export type IconTone = keyof typeof TONES;

/**
 * Los tipos (planes, fechas, lugares) guardan un emoji en los datos. En pantalla se muestran
 * como íconos de línea modernos en un fondo pastel. Un emoji que no está aquí (por ejemplo,
 * uno que eligieron ustedes para una fecha) se muestra tal cual.
 */
const ICONS: Record<string, { icon: LucideIcon; tone: IconTone }> = {
  "💑": { icon: HeartHandshake, tone: "blush" },
  "💞": { icon: Heart, tone: "blush" },
  "💗": { icon: Heart, tone: "blush" },
  "💖": { icon: Heart, tone: "blush" },
  "❤️": { icon: Heart, tone: "blush" },
  "🍽️": { icon: UtensilsCrossed, tone: "peach" },
  "✈️": { icon: Plane, tone: "sky" },
  "🎳": { icon: Ticket, tone: "mint" },
  "🎬": { icon: Clapperboard, tone: "lavender" },
  "🎯": { icon: Target, tone: "peach" },
  "📍": { icon: MapPin, tone: "blush" },
  "✨": { icon: Sparkles, tone: "lavender" },
  "🎂": { icon: Cake, tone: "peach" },
  "📅": { icon: CalendarHeart, tone: "mint" },
  "☕": { icon: Coffee, tone: "peach" },
  "🍰": { icon: IceCreamCone, tone: "blush" },
  "🍹": { icon: Martini, tone: "lavender" },
  "🌳": { icon: Trees, tone: "mint" },
  "🏛️": { icon: Landmark, tone: "sky" },
  "🌅": { icon: Sunset, tone: "peach" },
  "👀": { icon: Eye, tone: "sky" },
  "🙅": { icon: EyeOff, tone: "lavender" },
  "⭐": { icon: Star, tone: "peach" },
  "📸": { icon: Camera, tone: "blush" },
  "🔒": { icon: Lock, tone: "lavender" },
  "💌": { icon: Mail, tone: "lavender" },
};

/** Busca el ícono de un emoji (sin importar el selector de variación ️). */
export function iconFor(emoji: string | null | undefined) {
  if (!emoji) return null;
  return ICONS[emoji] ?? ICONS[emoji.replace(/️/g, "")] ?? ICONS[`${emoji}️`] ?? null;
}

const SIZES = {
  sm: { box: "h-9 w-9 rounded-xl", icon: 18, emoji: "text-lg" },
  md: { box: "h-11 w-11 rounded-2xl", icon: 21, emoji: "text-xl" },
  lg: { box: "h-14 w-14 rounded-2xl", icon: 26, emoji: "text-2xl" },
  xl: { box: "h-16 w-16 rounded-2xl", icon: 30, emoji: "text-3xl" },
} as const;

interface TileProps {
  emoji: string | null | undefined;
  size?: keyof typeof SIZES;
  /** Fuerza un tono (si no, usa el del ícono). */
  tone?: IconTone;
  muted?: boolean;
  className?: string;
}

/** Ícono dentro de un cuadrado pastel con bordes redondeados. */
export function IconTile({ emoji, size = "md", tone, muted = false, className = "" }: TileProps) {
  const match = iconFor(emoji);
  const s = SIZES[size];
  const toneClass = muted ? "bg-cream text-ink-soft/60" : TONES[tone ?? match?.tone ?? "lavender"];
  return (
    <span className={`flex shrink-0 items-center justify-center ${s.box} ${toneClass} ${className}`} aria-hidden>
      {match ? <match.icon size={s.icon} strokeWidth={1.75} /> : <span className={s.emoji}>{emoji ?? "♡"}</span>}
    </span>
  );
}

/** Ícono suelto para usar dentro de un texto o un chip (toma el color del texto). */
export function InlineIcon({ emoji, size = 15, className = "" }: { emoji: string; size?: number; className?: string }) {
  const match = iconFor(emoji);
  if (!match) return <span aria-hidden className={className}>{emoji}</span>;
  return <match.icon size={size} strokeWidth={2} className={`inline-block shrink-0 ${className}`} aria-hidden />;
}
