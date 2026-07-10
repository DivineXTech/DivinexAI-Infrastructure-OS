import Link from "next/link";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2 pt-8">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={prevDisabled}
        className={cn(
          "rounded-md border border-border px-3 py-1.5 text-sm",
          prevDisabled ? "pointer-events-none opacity-40" : "hover:bg-paper-muted",
        )}
      >
        Previous
      </Link>
      <span className="text-sm text-ink-muted">
        Page {page} of {totalPages}
      </span>
      <Link
        href={buildHref(Math.min(totalPages, page + 1))}
        aria-disabled={nextDisabled}
        className={cn(
          "rounded-md border border-border px-3 py-1.5 text-sm",
          nextDisabled ? "pointer-events-none opacity-40" : "hover:bg-paper-muted",
        )}
      >
        Next
      </Link>
    </nav>
  );
}
