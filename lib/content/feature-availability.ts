/**
 * Shared "is this real yet" label used across services/kits/equipment/
 * academy content. Keeping this as a closed type instead of a free-text
 * string is what stops a component from inventing its own ad-hoc label
 * that overstates readiness.
 */
export type FeatureAvailability = "available" | "early-access" | "planned";

export const FEATURE_AVAILABILITY_LABEL: Record<FeatureAvailability, string> = {
  available: "Available",
  "early-access": "Early Access",
  planned: "Planned",
};
