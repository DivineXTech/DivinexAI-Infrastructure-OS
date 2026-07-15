import { AvailabilityBadge } from "@/components/marketing/availability-badge";
import { SectionHeading } from "@/components/marketing/section-heading";
import { SERVICES } from "@/lib/content/services";

export function ServicesSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading
        eyebrow="Services"
        title="Guidance at every stage of your launch"
        description="Some services are available today; others are in early access or planned — labeled honestly below."
      />
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SERVICES.map((service) => (
          <div
            key={service.slug}
            className="flex items-start justify-between gap-3 rounded-lg border border-border p-4"
          >
            <div>
              <h3 className="text-sm font-semibold text-ink">{service.name}</h3>
              <p className="mt-1 text-sm text-ink-muted">{service.description}</p>
            </div>
            <AvailabilityBadge availability={service.availability} />
          </div>
        ))}
      </div>
    </section>
  );
}
