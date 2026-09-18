"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export function AnnouncementBar({
  message,
  href,
}: {
  message: string;
  href: string;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="flex items-center justify-center gap-3 bg-ink px-4 py-2 text-center text-sm text-background">
      <Link href={href} className="underline-offset-2 hover:underline">
        {message}
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        className="flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
