import { CalendarHeart, Camera, Compass, Gift, Heart, House, Mail, UserRound, type LucideIcon } from "lucide-react";

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
  tone: "blush" | "lavender" | "cream";
}

/** Accesos rápidos del Home. */
export const MODULES: ModuleItem[] = [
  { to: "/recuerdos", label: "Recuerdos", icon: Camera, tone: "blush" },
  { to: "/cartas", label: "Cartas", icon: Mail, tone: "lavender" },
  { to: "/planes", label: "Planes", icon: CalendarHeart, tone: "cream" },
  { to: "/descubrir", label: "Descubrir", icon: Compass, tone: "lavender" },
  { to: "/futuro", label: "Futuro", icon: Gift, tone: "cream" },
  { to: "/nosotros", label: "Nosotros", icon: Heart, tone: "blush" },
];
