import { trustStrip } from "@/lib/content/homepage";

export function TrustStrip() {
  return (
    <section className="border-y border-border bg-surface-muted">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-8">
        {trustStrip.map((capability) => (
          <span key={capability} className="text-sm font-medium text-ink-muted">
            {capability}
          </span>
        ))}
      </div>
    </section>
  );
}
