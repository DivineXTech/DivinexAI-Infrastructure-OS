import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "gold" | "outline" | "ghost";
type Size = "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  gold:
    "bg-gradient-to-b from-gold-300 to-gold-500 text-ink font-semibold shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_8px_24px_-8px_rgba(212,175,55,0.55)] hover:brightness-105 active:brightness-95",
  outline:
    "border border-gold-400/50 text-paper hover:bg-gold-400/10 hover:border-gold-400",
  ghost: "text-paper-dim hover:text-paper hover:bg-white/5",
};

const sizeClasses: Record<Size, string> = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

export function buttonVariants(variant: Variant = "gold", size: Size = "md"): string {
  return cn(
    "focus-gold inline-flex items-center justify-center gap-2 rounded-md transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",
    variantClasses[variant],
    sizeClasses[size],
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "gold", size = "md", ...props },
  ref,
) {
  return <button ref={ref} className={cn(buttonVariants(variant, size), className)} {...props} />;
});
