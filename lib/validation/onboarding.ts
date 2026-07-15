import { z } from "zod";

export const BRAND_PERSONALITIES = [
  "luxury",
  "streetwear",
  "athletic",
  "professional",
  "youth",
  "faith_based",
  "lifestyle",
  "workwear",
  "custom",
] as const;

export const brandStepSchema = z.object({
  brandName: z.string().min(1, "Brand name is required").max(160),
  tagline: z.string().max(200).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  primaryColor: z.string().max(20).optional().or(z.literal("")),
  secondaryColor: z.string().max(20).optional().or(z.literal("")),
  accentColor: z.string().max(20).optional().or(z.literal("")),
  typography: z.string().max(80).optional().or(z.literal("")),
  personality: z.enum(BRAND_PERSONALITIES).optional(),
  personalityOther: z.string().max(160).optional().or(z.literal("")),
  existingWebsite: z.string().max(300).optional().or(z.literal("")),
  logoPath: z.string().max(500).optional().or(z.literal("")),
});
export type BrandStepInput = z.infer<typeof brandStepSchema>;

export const CUSTOMER_TYPES = [
  "general_consumers",
  "schools",
  "churches",
  "sports_teams",
  "companies",
  "nonprofits",
  "events",
  "creators",
  "local_organizations",
  "online_communities",
] as const;

export const audienceStepSchema = z.object({
  customerTypes: z.array(z.string()).min(1, "Select at least one customer type"),
  ageRanges: z.array(z.string()).default([]),
  geographicFocus: z.string().max(200).optional().or(z.literal("")),
  marketType: z.enum(["b2c", "b2b", "both"]).optional(),
  stylePreferences: z.array(z.string()).default([]),
  purchaseMotivation: z.string().max(300).optional().or(z.literal("")),
  priceSensitivity: z.string().max(100).optional().or(z.literal("")),
  primarySalesChannel: z.string().max(100).optional().or(z.literal("")),
});
export type AudienceStepInput = z.infer<typeof audienceStepSchema>;

export const PRODUCT_CATEGORIES = [
  "t_shirts",
  "hoodies",
  "sweatshirts",
  "hats",
  "workwear",
  "athletic_apparel",
  "childrens_apparel",
  "bags",
  "promotional_merchandise",
  "custom_uniforms",
  "other",
] as const;

export const productsStepSchema = z
  .object({
    categories: z.array(z.string()).min(1, "Select at least one category"),
    launchQuantity: z.coerce.number().int().min(0).optional(),
    initialDesignCount: z.coerce.number().int().min(0).optional(),
    sizeRange: z.string().max(200).optional().or(z.literal("")),
    colorRange: z.string().max(200).optional().or(z.literal("")),
    customizationRequirements: z.string().max(1000).optional().or(z.literal("")),
    salesModel: z.enum(["retail", "wholesale", "both"]).optional(),
    targetPriceMinCents: z.coerce.number().int().min(0).optional(),
    targetPriceMaxCents: z.coerce.number().int().min(0).optional(),
  })
  .refine(
    (data) =>
      data.targetPriceMinCents === undefined ||
      data.targetPriceMaxCents === undefined ||
      data.targetPriceMinCents <= data.targetPriceMaxCents,
    {
      message: "Minimum price must be less than or equal to maximum price",
      path: ["targetPriceMaxCents"],
    },
  );
export type ProductsStepInput = z.infer<typeof productsStepSchema>;

export const productionStepSchema = z.object({
  preferredMethod: z
    .enum([
      "heat_transfer_vinyl",
      "dtf",
      "sublimation",
      "screen_printing",
      "embroidery",
      "outsourced",
      "hybrid",
    ])
    .optional(),
  experienceLevel: z.enum(["new", "some_experience", "experienced"]).optional(),
  workspace: z.enum(["none", "mobile", "shared_space", "home_dedicated", "commercial"]).optional(),
  expectedMonthlyVolume: z.coerce.number().int().min(0).optional(),
  equipmentOwned: z.boolean().default(false),
  existingEquipment: z.string().max(1000).optional().or(z.literal("")),
  outsourcingPreference: z.string().max(500).optional().or(z.literal("")),
});
export type ProductionStepInput = z.infer<typeof productionStepSchema>;

const budgetAllocationFields = {
  allocationEquipmentCents: z.coerce.number().int().min(0).optional(),
  allocationBlankApparelCents: z.coerce.number().int().min(0).optional(),
  allocationBrandingCents: z.coerce.number().int().min(0).optional(),
  allocationStorefrontCents: z.coerce.number().int().min(0).optional(),
  allocationMarketingCents: z.coerce.number().int().min(0).optional(),
  allocationPackagingCents: z.coerce.number().int().min(0).optional(),
  allocationTrainingCents: z.coerce.number().int().min(0).optional(),
  allocationWorkingCapitalCents: z.coerce.number().int().min(0).optional(),
};

export const budgetStepSchema = z
  .object({
    budgetBand: z.enum([
      "under_500",
      "500_1500",
      "1500_5000",
      "5000_15000",
      "15000_plus",
      "custom_undecided",
    ]),
    preciseTotalCents: z.coerce.number().int().min(0).optional(),
    ...budgetAllocationFields,
  })
  .refine(
    (data) => {
      if (data.preciseTotalCents === undefined) return true;
      const sum =
        (data.allocationEquipmentCents ?? 0) +
        (data.allocationBlankApparelCents ?? 0) +
        (data.allocationBrandingCents ?? 0) +
        (data.allocationStorefrontCents ?? 0) +
        (data.allocationMarketingCents ?? 0) +
        (data.allocationPackagingCents ?? 0) +
        (data.allocationTrainingCents ?? 0) +
        (data.allocationWorkingCapitalCents ?? 0);
      return sum <= data.preciseTotalCents;
    },
    { message: "Allocations cannot exceed your total budget", path: ["preciseTotalCents"] },
  );
export type BudgetStepInput = z.infer<typeof budgetStepSchema>;

export const startupKitOverrideSchema = z.object({
  selectedKitSlug: z.string().min(1),
});
export type StartupKitOverrideInput = z.infer<typeof startupKitOverrideSchema>;

const PAYMENT_METHOD_STATUS = ["connected", "available", "planned", "not_available"] as const;

export const storefrontStepSchema = z.object({
  storefrontName: z.string().max(160).optional().or(z.literal("")),
  themeDirection: z.string().max(160).optional().or(z.literal("")),
  heroMessaging: z.string().max(500).optional().or(z.literal("")),
  featuredCategories: z.array(z.string()).default([]),
  domainStatus: z.enum(["none", "have_domain", "need_domain"]).optional(),
  existingDomain: z.string().max(300).optional().or(z.literal("")),
  contactChannel: z.string().max(200).optional().or(z.literal("")),
  announcementBarText: z.string().max(200).optional().or(z.literal("")),
  fulfillmentOffer: z.enum(["pickup", "shipping", "both"]).optional(),
  plannedPaymentMethods: z.record(z.string(), z.enum(PAYMENT_METHOD_STATUS)).default({}),
});
export type StorefrontStepInput = z.infer<typeof storefrontStepSchema>;

export const fulfillmentStepSchema = z.object({
  fulfillmentModel: z
    .enum(["self_fulfillment", "local_pickup", "third_party", "supplier_direct", "hybrid"])
    .optional(),
  productionLeadTimeDays: z.coerce.number().int().min(0).optional(),
  pickupLocationPlaceholder: z.string().max(300).optional().or(z.literal("")),
  shippingRegions: z.array(z.string()).default([]),
  returnPolicyStatus: z.enum(["defined", "in_progress", "not_started"]).optional(),
  packagingPreference: z.string().max(300).optional().or(z.literal("")),
  trackingRequired: z.boolean().default(false),
  qcResponsibility: z.string().max(300).optional().or(z.literal("")),
});
export type FulfillmentStepInput = z.infer<typeof fulfillmentStepSchema>;
