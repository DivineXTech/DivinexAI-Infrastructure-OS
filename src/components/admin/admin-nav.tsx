"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/creators", label: "Creators" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-md px-3 py-2 text-sm font-medium text-ink-muted hover:bg-paper-muted hover:text-ink",
              isActive && "bg-accent-soft text-accent-strong hover:bg-accent-soft",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
