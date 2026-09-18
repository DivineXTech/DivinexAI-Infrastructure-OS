export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex min-h-[60vh] items-center justify-center"
    >
      <div className="size-8 animate-spin rounded-full border-2 border-border-strong border-t-ink" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
