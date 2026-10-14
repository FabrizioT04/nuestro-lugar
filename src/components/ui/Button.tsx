import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/85",
  secondary: "bg-blush-50 text-ink hover:bg-blush-200",
  ghost: "text-ink-soft hover:text-ink",
};

export const buttonClass = (variant: Variant = "primary", className = "") =>
  `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 ${VARIANTS[variant]} ${className}`;

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}
