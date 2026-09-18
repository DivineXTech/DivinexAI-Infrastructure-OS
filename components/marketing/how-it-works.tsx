import { SectionHeading } from "@/components/marketing/section-heading";
import { howItWorks } from "@/lib/content/homepage";

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading
        eyebrow="How it works"
        title="From idea to operating clothing brand"
        description="Six steps guide you from a brand concept to a running apparel business."
      />
      <ol className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {howItWorks.map((item) => (
          <li key={item.step} className="flex flex-col gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-background">
              {item.step}
            </span>
            <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
            <p className="text-sm text-ink-muted">{item.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
