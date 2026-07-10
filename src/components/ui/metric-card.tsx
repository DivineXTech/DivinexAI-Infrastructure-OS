import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  trend,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-5", className)}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-medium text-ink">{value}</p>
      {trend ? (
        <p
          className={cn(
            "mt-1 text-xs font-medium",
            trend.direction === "up" && "text-success",
            trend.direction === "down" && "text-danger",
            trend.direction === "flat" && "text-ink-muted",
          )}
        >
          {trend.label}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
