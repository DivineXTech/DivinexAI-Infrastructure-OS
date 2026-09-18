import {
  getAudience,
  getBrandProfile,
  getBudgetProfile,
  getFulfillmentPreferences,
  getLaunchReadinessAssessment,
  getProductPreferences,
  getProductionPreferences,
  getStartupKitRecommendation,
  getStorefrontPreferences,
} from "@/lib/onboarding/data-access";
import { requireOnboardingReviewAccess, type OnboardingReviewSection } from "@/lib/onboarding/guard";
import { ReviewPanel, type ReviewSectionSummary } from "@/components/onboarding/review-panel";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { STARTUP_KITS } from "@/lib/content/startup-kits";

const SECTION_LABELS: Record<OnboardingReviewSection, string> = {
  brand: "Brand identity",
  audience: "Audience",
  products: "Product strategy",
  production: "Production method",
  budget: "Budget",
  startup_kit: "Startup kit",
  storefront: "Storefront",
  fulfillment: "Fulfillment",
};

const SECTION_HREFS: Record<OnboardingReviewSection, string> = {
  brand: "/app/onboarding/brand",
  audience: "/app/onboarding/audience",
  products: "/app/onboarding/products",
  production: "/app/onboarding/production",
  budget: "/app/onboarding/budget",
  startup_kit: "/app/onboarding/startup-kit",
  storefront: "/app/onboarding/storefront",
  fulfillment: "/app/onboarding/fulfillment",
};

export default async function ReviewStepPage() {
  const access = await requireOnboardingReviewAccess();
  const tenantId = access.membership.tenantId;

  const sections: ReviewSectionSummary[] = [];

  for (const key of access.visibleSections) {
    let lines: string[] = [];

    if (key === "brand") {
      const brand = await getBrandProfile(tenantId);
      if (brand) {
        lines = [
          `Name: ${brand.brandName}`,
          brand.tagline ? `Tagline: ${brand.tagline}` : "",
          brand.personality ? `Personality: ${brand.personality.replace(/_/g, " ")}` : "",
          brand.logoPath ? "Logo uploaded" : "No logo yet",
        ].filter(Boolean);
      }
    } else if (key === "audience") {
      const audience = await getAudience(tenantId);
      if (audience) {
        lines = [
          audience.customerTypes.length > 0
            ? `Customer types: ${audience.customerTypes.join(", ").replace(/_/g, " ")}`
            : "",
          audience.marketType ? `Market: ${audience.marketType.toUpperCase()}` : "",
        ].filter(Boolean);
      }
    } else if (key === "products") {
      const products = await getProductPreferences(tenantId);
      if (products) {
        lines = [
          products.categories.length > 0
            ? `Categories: ${products.categories.join(", ").replace(/_/g, " ")}`
            : "",
          products.launchQuantity !== null ? `Launch quantity: ${products.launchQuantity}` : "",
          products.salesModel ? `Sales model: ${products.salesModel}` : "",
        ].filter(Boolean);
      }
    } else if (key === "production") {
      const production = await getProductionPreferences(tenantId);
      if (production) {
        lines = [
          production.preferredMethod ? `Method: ${production.preferredMethod.replace(/_/g, " ")}` : "",
          production.experienceLevel ? `Experience: ${production.experienceLevel.replace(/_/g, " ")}` : "",
          production.workspace ? `Workspace: ${production.workspace.replace(/_/g, " ")}` : "",
          production.equipmentOwned ? "Equipment already owned" : "",
        ].filter(Boolean);
      }
    } else if (key === "budget") {
      const budget = await getBudgetProfile(tenantId);
      if (budget) {
        lines = [`Budget band: ${budget.budgetBand.replace(/_/g, " ")}`];
      }
    } else if (key === "startup_kit") {
      const recommendation = await getStartupKitRecommendation(tenantId);
      if (recommendation) {
        const slug = recommendation.userSelectedKitSlug ?? recommendation.recommendedKitSlug;
        const kit = STARTUP_KITS.find((k) => k.slug === slug);
        lines = [
          `Selected: ${kit?.name ?? slug}`,
          recommendation.overridden ? "Overridden from recommendation" : "Matches recommendation",
        ];
      }
    } else if (key === "storefront") {
      const storefront = await getStorefrontPreferences(tenantId);
      if (storefront) {
        lines = [
          storefront.storefrontName ? `Name: ${storefront.storefrontName}` : "",
          storefront.domainStatus ? `Domain: ${storefront.domainStatus.replace(/_/g, " ")}` : "",
          storefront.fulfillmentOffer ? `Offers: ${storefront.fulfillmentOffer}` : "",
        ].filter(Boolean);
      }
    } else if (key === "fulfillment") {
      const fulfillment = await getFulfillmentPreferences(tenantId);
      if (fulfillment) {
        lines = [
          fulfillment.fulfillmentModel ? `Model: ${fulfillment.fulfillmentModel.replace(/_/g, " ")}` : "",
          fulfillment.returnPolicyStatus ? `Return policy: ${fulfillment.returnPolicyStatus.replace(/_/g, " ")}` : "",
        ].filter(Boolean);
      }
    }

    sections.push({ key, label: SECTION_LABELS[key], href: SECTION_HREFS[key], lines });
  }

  const readiness = access.canEdit ? await getLaunchReadinessAssessment(tenantId) : null;

  return (
    <WizardShell
      currentStep="review"
      stepProgress={access.stepProgress}
      completionPercentage={access.session?.completionPercentage ?? 0}
    >
      <ReviewPanel canEdit={access.canEdit} sections={sections} readiness={readiness} />
    </WizardShell>
  );
}
