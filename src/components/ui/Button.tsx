import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-blush-300 text-ink shadow-soft hover:bg-blush-200",
  secondary: "border border-blush-200 bg-paper text-blush-700 hover:bg-blush-50",
  ghost: "text-ink-soft hover:text-ink",
};

export const buttonClass = (variant: Variant = "primary", className = "") =>
  `inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold transition active:scale-[0.98] disabled:opacity-60 ${VARIANTS[variant]} ${className}`;

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}
