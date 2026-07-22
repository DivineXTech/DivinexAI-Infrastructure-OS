import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CheckboxFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  error?: string;
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(
  function CheckboxField({ label, error, className, id, ...props }, ref) {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="flex items-start gap-3 cursor-pointer select-none">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            className={cn(
              "focus-gold mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border border-white/20 bg-white/[0.03] accent-gold-400",
              className,
            )}
            {...props}
          />
          <span className="text-sm leading-relaxed text-paper-dim">{label}</span>
        </label>
        {error && <p className="ml-7 text-xs text-rose-400">{error}</p>}
      </div>
    );
  },
);
