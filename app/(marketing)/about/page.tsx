import type { Metadata } from "next";

import { PageHeader } from "@/components/marketing/page-header";
import { company, leadership } from "@/lib/content/company";

export const metadata: Metadata = {
  title: "About",
  description: `About ${company.legalName} and the ${company.poweredBy} ecosystem.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title={`About ${company.legalName}`}
        description={company.tagline}
      />
      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex flex-col gap-6 text-ink-muted">
          <p>
            {company.legalName} exists to help entrepreneurs launch and
            operate a professional clothing brand from one platform — brand
            creation, apparel design, equipment selection, production
            workflow, storefront tools, and training, without needing
            separate tools and vendors for each piece.
          </p>
          <p>{company.poweredByDescription}</p>
        </div>

        <h2 className="mt-12 text-xl font-semibold text-ink">Leadership</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {leadership.map((leader) => (
            <div key={leader.name} className="rounded-lg border border-border p-4">
              <p className="font-semibold text-ink">{leader.name}</p>
              <p className="text-sm text-ink-muted">{leader.title}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
