import type { HomeBadges } from "@shared/api";
import { CalendarHeart, Camera, Compass, Gift, Heart, House, Mail, Music, Palette, UserRound, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Navegación inferior (siempre visible). */
export const BOTTOM_NAV: NavItem[] = [
  { to: "/", label: "Inicio", icon: House },
  { to: "/recuerdos", label: "Recuerdos", icon: Camera },
  { to: "/nosotros", label: "Nosotros", icon: Heart },
  { to: "/planes", label: "Planes", icon: CalendarHeart },
  { to: "/perfil", label: "Perfil", icon: UserRound },
];

export interface ModuleItem extends NavItem {
  tone: "blush" | "lavender" | "mint";
  /** Qué globito de novedades lleva en el inicio. */
  badge?: keyof HomeBadges;
}

/** Accesos rápidos del Home. */
export const MODULES: ModuleItem[] = [
  { to: "/recuerdos", label: "Recuerdos", icon: Camera, tone: "blush", badge: "memories" },
  { to: "/cartas", label: "Cartas", icon: Mail, tone: "lavender", badge: "letters" },
  { to: "/planes", label: "Planes", icon: CalendarHeart, tone: "mint", badge: "plans" },
  { to: "/descubrir", label: "Descubrir", icon: Compass, tone: "mint" },
  { to: "/futuro", label: "Futuro", icon: Gift, tone: "lavender", badge: "future" },
  { to: "/nosotros", label: "Nosotros", icon: Heart, tone: "blush", badge: "us" },
  { to: "/dibujos", label: "Dibujos", icon: Palette, tone: "lavender", badge: "drawings" },
  { to: "/canciones", label: "Canciones", icon: Music, tone: "blush", badge: "songs" },
];
