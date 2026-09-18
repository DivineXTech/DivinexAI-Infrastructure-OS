"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";

import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import type { NavItem } from "@/lib/navigation";

export function MobileNav({ items, brand }: { items: NavItem[]; brand: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Open navigation"
          className="flex size-9 items-center justify-center rounded-md text-ink md:hidden"
        >
          <Menu className="size-5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 md:hidden" />
        <Dialog.Content
          className="fixed inset-y-0 left-0 z-50 w-72 bg-surface p-4 shadow-lg md:hidden"
          aria-describedby={undefined}
        >
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-ink">
              {brand}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close navigation"
                className="flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          <SidebarNav items={items} onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
