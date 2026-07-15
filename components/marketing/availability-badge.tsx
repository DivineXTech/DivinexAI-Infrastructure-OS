import { Badge } from "@/components/ui/badge";
import {
  FEATURE_AVAILABILITY_LABEL,
  type FeatureAvailability,
} from "@/lib/content/feature-availability";

const VARIANT: Record<FeatureAvailability, "success" | "accent" | "outline"> = {
  available: "success",
  "early-access": "accent",
  planned: "outline",
};

export function AvailabilityBadge({
  availability,
}: {
  availability: FeatureAvailability;
}) {
  return (
    <Badge variant={VARIANT[availability]}>
      {FEATURE_AVAILABILITY_LABEL[availability]}
    </Badge>
  );
}
