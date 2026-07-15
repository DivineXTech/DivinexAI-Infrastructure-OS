import Link from "next/link";

import { SectionHeading } from "@/components/marketing/section-heading";
import { Button } from "@/components/ui/button";
import { ACADEMY_TOPICS } from "@/lib/content/academy";

export function AcademySection() {
  return (
    <section className="bg-surface-muted py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Academy"
          title="Learn the business, not just the printing"
          description="Training built for founders who are new to apparel."
        />
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {ACADEMY_TOPICS.map((topic) => (
            <span
              key={topic}
              className="rounded-full border border-border-strong bg-surface px-4 py-2 text-sm text-ink-muted"
            >
              {topic}
            </span>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Button asChild variant="outline">
            <Link href="/academy">Explore the Academy</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
