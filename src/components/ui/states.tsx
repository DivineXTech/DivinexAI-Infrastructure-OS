import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-paper-muted px-6 py-12 text-center",
        className,
      )}
    >
      {icon}
      <p className="font-display text-lg font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-lg border border-danger-soft bg-danger-soft px-6 py-12 text-center"
    >
      <p className="font-display text-lg font-medium text-danger">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-paper-muted", className)}
      aria-hidden="true"
    />
  );
}

export function ComingSoon({ label = "Coming soon" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-paper-muted px-2.5 py-0.5 text-xs font-medium text-ink-muted">
      {label}
    </span>
  );
}
