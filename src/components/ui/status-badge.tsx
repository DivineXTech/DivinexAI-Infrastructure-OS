import { Badge } from "@/components/ui/badge";

const STATUS_TONE: Record<string, "neutral" | "accent" | "teal" | "success" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  in_review: "warning",
  pending: "warning",
  pending_review: "warning",
  processing: "info",
  published: "success",
  approved: "success",
  paid: "success",
  fulfilled: "success",
  active: "success",
  rejected: "danger",
  suspended: "danger",
  failed: "danger",
  cancelled: "danger",
  disputed: "danger",
  refunded: "neutral",
  partially_refunded: "warning",
  unlisted: "neutral",
  archived: "neutral",
  restricted: "danger",
  not_started: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  const label = status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return <Badge tone={tone}>{label}</Badge>;
}
