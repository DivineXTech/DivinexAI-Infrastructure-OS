"use client";

import Link from "next/link";

import { Breadcrumbs } from "@/components/app-shell/breadcrumbs";
import { CommandPalette } from "@/components/app-shell/command-palette";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { NotificationsButton } from "@/components/app-shell/notifications-button";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { SignOutButton } from "@/components/app-shell/sign-out-button";
import { TenantSwitcher, type TenantOption } from "@/components/app-shell/tenant-switcher";
import type { NavItem } from "@/lib/navigation";

export function AppShell({
  brand,
  brandHref,
  navItems,
  breadcrumbRootLabel,
  tenant,
  tenantOptions,
  children,
}: {
  brand: string;
  brandHref: string;
  navItems: NavItem[];
  breadcrumbRootLabel: string;
  tenant?: TenantOption;
  tenantOptions?: TenantOption[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border p-4 md:flex md:flex-col">
        <Link href={brandHref} className="mb-6 px-2 text-lg font-semibold text-ink">
          {brand}
        </Link>
        <SidebarNav items={navItems} />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-border px-4">
          <MobileNav items={navItems} brand={brand} />
          {tenant && tenantOptions ? (
            <TenantSwitcher current={tenant} options={tenantOptions} />
          ) : null}
          <div className="hidden flex-1 md:block">
            <Breadcrumbs rootLabel={breadcrumbRootLabel} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden lg:block">
              <CommandPalette items={navItems} />
            </div>
            <NotificationsButton />
            <SignOutButton />
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
