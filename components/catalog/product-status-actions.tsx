"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateProductStatusAction } from "@/app/app/products/actions";
import { Button } from "@/components/ui/button";
import type { ProductRow } from "@/lib/catalog/data-access";

const NEXT_STATUS: Record<ProductRow["status"], ProductRow["status"][]> = {
  draft: ["ready_for_review", "archived"],
  ready_for_review: ["approved", "draft"],
  approved: ["active", "draft"],
  active: ["paused", "archived"],
  paused: ["active", "archived"],
  archived: [],
};

const STATUS_LABELS: Record<ProductRow["status"], string> = {
  draft: "Draft",
  ready_for_review: "Ready for review",
  approved: "Approved",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

export function ProductStatusActions({ productId, status }: { productId: string; status: ProductRow["status"] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTransition(toStatus: ProductRow["status"]) {
    setBusy(true);
    setError(null);
    const result = await updateProductStatusAction(productId, toStatus);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {NEXT_STATUS[status].map((next) => (
          <Button key={next} type="button" size="sm" variant="outline" disabled={busy} onClick={() => handleTransition(next)}>
            Move to {STATUS_LABELS[next]}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
