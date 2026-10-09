import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface FieldShellProps {
  label: string;
  htmlFor: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}

export function FieldShell({ label, htmlFor, error, optional, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-paper-dim">
        {label} {optional && <span className="text-paper-dim/50">(optional)</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

const inputBaseClasses =
  "focus-gold w-full rounded-md border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-paper placeholder:text-paper-dim/40 outline-none transition-colors focus:border-gold-400/60";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, hasError, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(inputBaseClasses, hasError && "border-rose-500/60", className)}
      {...props}
    />
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cn(inputBaseClasses, className)} {...props}>
      {children}
    </select>
  );
});
