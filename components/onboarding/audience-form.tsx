"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";

import { saveAudienceStepAction } from "@/app/app/onboarding/wizard-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CUSTOMER_TYPES, audienceStepSchema, type AudienceStepInput } from "@/lib/validation/onboarding";

const CUSTOMER_TYPE_LABELS: Record<(typeof CUSTOMER_TYPES)[number], string> = {
  general_consumers: "General consumers",
  schools: "Schools",
  churches: "Churches",
  sports_teams: "Sports teams",
  companies: "Companies",
  nonprofits: "Nonprofits",
  events: "Events",
  creators: "Creators",
  local_organizations: "Local organizations",
  online_communities: "Online communities",
};

const AGE_RANGES = ["under_18", "18_24", "25_34", "35_44", "45_54", "55_plus"] as const;
const AGE_RANGE_LABELS: Record<(typeof AGE_RANGES)[number], string> = {
  under_18: "Under 18",
  "18_24": "18–24",
  "25_34": "25–34",
  "35_44": "35–44",
  "45_54": "45–54",
  "55_plus": "55+",
};

const STYLE_PREFERENCES = ["minimalist", "bold_graphic", "vintage", "modern", "handcrafted", "premium"] as const;
const STYLE_LABELS: Record<(typeof STYLE_PREFERENCES)[number], string> = {
  minimalist: "Minimalist",
  bold_graphic: "Bold / graphic",
  vintage: "Vintage",
  modern: "Modern",
  handcrafted: "Handcrafted",
  premium: "Premium",
};

export function AudienceForm({ defaultValues }: { defaultValues: Partial<AudienceStepInput> }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AudienceStepInput>({
    resolver: zodResolver(audienceStepSchema) as Resolver<AudienceStepInput>,
    defaultValues: {
      customerTypes: [],
      ageRanges: [],
      stylePreferences: [],
      ...defaultValues,
    },
  });

  async function onSubmit(values: AudienceStepInput, saveAndExit: boolean) {
    setFormError(null);
    const result = await saveAudienceStepAction(values, { saveAndExit });
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    router.push(result.redirectTo);
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-5" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Who are your customers?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CUSTOMER_TYPES.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" value={value} {...register("customerTypes")} className="size-4" />
              {CUSTOMER_TYPE_LABELS[value]}
            </label>
          ))}
        </div>
        {errors.customerTypes ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.customerTypes.message}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Age ranges</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {AGE_RANGES.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" value={value} {...register("ageRanges")} className="size-4" />
              {AGE_RANGE_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="geographicFocus">Geographic focus</Label>
        <Input id="geographicFocus" placeholder="e.g. local, regional, national" {...register("geographicFocus")} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Market type</legend>
        <div className="flex gap-4">
          {(["b2c", "b2b", "both"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="radio" value={value} {...register("marketType")} className="size-4" />
              {value.toUpperCase()}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Style preferences</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STYLE_PREFERENCES.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" value={value} {...register("stylePreferences")} className="size-4" />
              {STYLE_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="purchaseMotivation">What motivates their purchase?</Label>
        <Input id="purchaseMotivation" {...register("purchaseMotivation")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="priceSensitivity">Price sensitivity</Label>
        <Input id="priceSensitivity" placeholder="e.g. budget-conscious, premium-tolerant" {...register("priceSensitivity")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="primarySalesChannel">Primary sales channel</Label>
        <Input id="primarySalesChannel" placeholder="e.g. Instagram, in-person, storefront" {...register("primarySalesChannel")} />
      </div>

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={isSubmitting} onClick={handleSubmit((values) => onSubmit(values, false))}>
          {isSubmitting ? "Saving…" : "Save and continue"}
        </Button>
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={handleSubmit((values) => onSubmit(values, true))}>
          Save and exit
        </Button>
      </div>
    </form>
  );
}
