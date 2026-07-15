"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

function toLabel(segment: string) {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function Breadcrumbs({ rootLabel }: { rootLabel: string }) {
  const pathname = usePathname() ?? "/";
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, index) => ({
    label: toLabel(segment),
    href: "/" + segments.slice(0, index + 1).join("/"),
  }));

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href={`/${segments[0] ?? ""}`} className="hover:text-ink">
            {rootLabel}
          </Link>
        </li>
        {crumbs.slice(1).map((crumb, index) => (
          <Fragment key={crumb.href}>
            <li aria-hidden="true">/</li>
            <li>
              {index === crumbs.length - 2 ? (
                <span aria-current="page" className="text-ink">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="hover:text-ink">
                  {crumb.label}
                </Link>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
