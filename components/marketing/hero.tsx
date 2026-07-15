import Link from "next/link";

import { ApparelDemo } from "@/components/marketing/apparel-demo";
import { Button } from "@/components/ui/button";
import { hero } from "@/lib/content/homepage";

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
      <div className="flex flex-col gap-6">
        <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          {hero.headline}
        </h1>
        <p className="max-w-xl text-lg text-ink-muted">{hero.subheadline}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" asChild>
            <Link href={hero.primaryCta.href}>{hero.primaryCta.label}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href={hero.secondaryCta.href}>{hero.secondaryCta.label}</Link>
          </Button>
        </div>
        <Link
          href={hero.tertiaryCta.href}
          className="text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          {hero.tertiaryCta.label} →
        </Link>
      </div>
      <ApparelDemo />
    </section>
  );
}
