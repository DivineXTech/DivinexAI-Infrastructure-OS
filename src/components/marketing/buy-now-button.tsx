"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

export function BuyNowButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    track("purchase_checkout_started");

    try {
      const response = await fetch("/api/checkout", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.url) {
        setError(payload.error ?? "Checkout is unavailable right now.");
        setLoading(false);
        return;
      }
      window.location.href = payload.url;
    } catch {
      setError("We couldn't reach the server. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button type="button" size="lg" onClick={handleClick} disabled={loading}>
        {loading ? "Redirecting to checkout…" : "Buy Now — $19.97"}
      </Button>
      {error && <p className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
