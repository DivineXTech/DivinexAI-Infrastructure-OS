import { EmptyState, ComingSoon } from "@/components/ui/states";

export default function LibrarySavedPage() {
  return (
    <EmptyState
      title="Saved products"
      description="Wishlist and follow-based collections ship in Phase 3."
      icon={<ComingSoon />}
    />
  );
}
