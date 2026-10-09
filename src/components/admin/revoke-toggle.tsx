"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AdminRevokeToggle({
  subscriberId,
  revoked,
}: {
  subscriberId: string;
  revoked: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    try {
      const response = await fetch(`/api/admin/subscribers/${subscriberId}/chapter12-access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revoked: !revoked }),
      });
      if (!response.ok) {
        setError("Failed");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Failed");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="focus-gold rounded-md border border-white/10 px-2.5 py-1 text-xs text-paper-dim transition-colors hover:border-gold-400/40 hover:text-paper disabled:opacity-50"
    >
      {error ? "Error" : revoked ? "Restore access" : "Revoke access"}
    </button>
  );
}
