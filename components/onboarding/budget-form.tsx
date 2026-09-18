"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";

import { saveBudgetStepAction } from "@/app/app/onboarding/wizard-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { budgetStepSchema, type BudgetStepInput } from "@/lib/validation/onboarding";

const BUDGET_BANDS = [
  ["under_500", "Under $500"],
  ["500_1500", "$500–$1,500"],
  ["1500_5000", "$1,500–$5,000"],
  ["5000_15000", "$5,000–$15,000"],
  ["15000_plus", "$15,000+"],
  ["custom_undecided", "Not sure yet / custom"],
] as const;

const ALLOCATION_FIELDS = [
  ["allocationEquipmentCents", "Equipment"],
  ["allocationBlankApparelCents", "Blank apparel"],
  ["allocationBrandingCents", "Branding"],
  ["allocationStorefrontCents", "Storefront"],
  ["allocationMarketingCents", "Marketing"],
  ["allocationPackagingCents", "Packaging"],
  ["allocationTrainingCents", "Training"],
  ["allocationWorkingCapitalCents", "Working capital"],
] as const;

const CENTS_FIELDS = [
  "preciseTotalCents",
  ...ALLOCATION_FIELDS.map(([key]) => key),
] as const;

export function BudgetForm({ defaultValues }: { defaultValues: Partial<BudgetStepInput> }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BudgetStepInput>({
    resolver: zodResolver(budgetStepSchema) as Resolver<BudgetStepInput>,
    defaultValues,
  });

  async function onSubmit(values: BudgetStepInput, saveAndExit: boolean) {
    setFormError(null);
    const payload: Record<string, unknown> = { ...values };
    for (const key of CENTS_FIELDS) {
      const raw = (values as Record<string, unknown>)[key];
      payload[key] = typeof raw === "number" ? Math.round(raw * 100) : undefined;
    }
    const result = await saveBudgetStepAction(payload, { saveAndExit });
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
        <legend className="text-sm font-medium text-ink">Launch budget band</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {BUDGET_BANDS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="radio" value={value} {...register("budgetBand")} className="size-4" />
              {label}
            </label>
          ))}
        </div>
        {errors.budgetBand ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.budgetBand.message}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-1.5 sm:w-1/2">
        <Label htmlFor="preciseTotalCents">Precise total budget (USD, optional)</Label>
        <Input id="preciseTotalCents" type="number" min={0} step="0.01" {...register("preciseTotalCents")} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Planned allocation (USD, optional)</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ALLOCATION_FIELDS.map(([key, label]) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input id={key} type="number" min={0} step="0.01" {...register(key)} />
            </div>
          ))}
        </div>
        {errors.preciseTotalCents ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.preciseTotalCents.message}
          </p>
        ) : null}
      </fieldset>

      <p className="text-xs text-ink-subtle">
        This is planning guidance to help size a startup-kit recommendation — not a purchase or financial commitment.
      </p>

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
