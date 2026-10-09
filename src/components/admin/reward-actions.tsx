"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RewardActions({ grantId }: { grantId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "deny" | "fulfill") {
    setPending(action);
    setError(null);
    try {
      const response = await fetch(`/api/admin/rewards/${grantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        setError("Failed");
        setPending(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Failed");
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="md" onClick={() => act("approve")} disabled={pending !== null}>
        {pending === "approve" ? "Approving…" : "Approve"}
      </Button>
      <Button type="button" variant="outline" size="md" onClick={() => act("fulfill")} disabled={pending !== null}>
        {pending === "fulfill" ? "Fulfilling…" : "Mark Fulfilled"}
      </Button>
      <Button type="button" variant="ghost" size="md" onClick={() => act("deny")} disabled={pending !== null}>
        {pending === "deny" ? "Denying…" : "Deny"}
      </Button>
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
