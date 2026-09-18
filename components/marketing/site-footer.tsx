import Link from "next/link";

import { company } from "@/lib/content/company";
import { FOOTER_NAV } from "@/lib/content/navigation";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-12 sm:grid-cols-4">
        {FOOTER_NAV.map((group) => (
          <div key={group.heading} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-ink">{group.heading}</h3>
            <ul className="flex flex-col gap-2">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-ink-muted hover:text-ink">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-ink-subtle">
          {company.legalName} OS &mdash; powered by the {company.poweredBy} ecosystem.
        </div>
      </div>
    </footer>
  );
}
