"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Bell } from "lucide-react";

export function NotificationsButton() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <Bell className="size-4" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className="fixed right-4 top-16 z-50 w-full max-w-sm rounded-lg border border-border bg-surface p-4 shadow-lg"
          aria-describedby="notifications-description"
        >
          <Dialog.Title className="text-sm font-semibold text-ink">
            Notifications
          </Dialog.Title>
          <p id="notifications-description" className="mt-2 text-sm text-ink-muted">
            You have no notifications yet. Order, production, and support
            alerts will appear here once those modules ship.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
