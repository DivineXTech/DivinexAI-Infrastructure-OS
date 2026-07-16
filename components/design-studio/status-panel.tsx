"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { approveDesignAction, requestDesignChangesAction, submitDesignForReviewAction } from "@/app/app/design-studio/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DesignProjectStatus } from "@/lib/design-studio/data-access";

const STATUS_LABELS: Record<DesignProjectStatus, string> = {
  draft: "Draft",
  needs_artwork: "Needs artwork",
  ready_for_review: "Ready for review",
  changes_requested: "Changes requested",
  approved: "Approved",
  converted_to_product: "Converted to product",
  archived: "Archived",
};

/** Approval buttons only render for callers the server has already
 * confirmed hold an approval role (`canApprove`, computed server-side
 * from the authenticated membership) — hiding them for anyone else is a
 * UX nicety, not the security boundary; requireDesignApprovalAccess()
 * enforces that server-side regardless of what this component renders. */
export function StatusPanel({
  projectId,
  status,
  canSubmit,
  canApprove,
}: {
  projectId: string;
  status: DesignProjectStatus;
  canSubmit: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setBusy(true);
    const result = await submitDesignForReviewAction(projectId);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function handleApprove() {
    setBusy(true);
    const result = await approveDesignAction(projectId);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function handleRequestChanges() {
    const notes = window.prompt("What changes are needed?") ?? undefined;
    setBusy(true);
    const result = await requestDesignChangesAction(projectId, notes);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="accent">{STATUS_LABELS[status]}</Badge>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {canSubmit && (status === "draft" || status === "needs_artwork" || status === "changes_requested") ? (
        <Button type="button" size="sm" disabled={busy} onClick={handleSubmit}>
          Submit for review
        </Button>
      ) : null}
      {canApprove && status === "ready_for_review" ? (
        <>
          <Button type="button" size="sm" disabled={busy} onClick={handleApprove}>
            Approve
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={handleRequestChanges}>
            Request changes
          </Button>
        </>
      ) : null}
    </div>
  );
}
