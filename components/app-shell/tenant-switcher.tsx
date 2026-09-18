"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronsUpDown, Check } from "lucide-react";

import { setCurrentTenantAction } from "@/app/app/actions";
import { cn } from "@/lib/utils";

export type TenantOption = { tenantId: string; tenantSlug: string; tenantName: string };

export function TenantSwitcher({
  current,
  options,
}: {
  current: TenantOption;
  options: TenantOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectTenant(tenantSlug: string) {
    startTransition(async () => {
      await setCurrentTenantAction(tenantSlug);
      router.refresh();
    });
  }

  if (options.length <= 1) {
    return (
      <div className="flex h-9 items-center rounded-md px-2 text-sm font-medium text-ink">
        {current.tenantName}
      </div>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={isPending}
          className="flex h-9 items-center gap-2 rounded-md px-2 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50"
        >
          {current.tenantName}
          <ChevronsUpDown className="size-4 text-ink-subtle" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          className="z-50 min-w-56 rounded-md border border-border bg-surface p-1 shadow-lg"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.tenantId}
              onSelect={() => selectTenant(option.tenantSlug)}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm outline-none",
                "hover:bg-surface-muted",
              )}
            >
              {option.tenantName}
              {option.tenantId === current.tenantId ? (
                <Check className="size-4 text-accent" />
              ) : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
