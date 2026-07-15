"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";

import { saveFulfillmentStepAction } from "@/app/app/onboarding/wizard-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fulfillmentStepSchema, type FulfillmentStepInput } from "@/lib/validation/onboarding";

const MODELS = [
  ["self_fulfillment", "Self-fulfillment"],
  ["local_pickup", "Local pickup"],
  ["third_party", "Third-party fulfillment"],
  ["supplier_direct", "Supplier ships direct"],
  ["hybrid", "Hybrid"],
] as const;

const SHIPPING_REGIONS = ["local", "regional", "national", "international"] as const;

export function FulfillmentForm({ defaultValues }: { defaultValues: Partial<FulfillmentStepInput> }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FulfillmentStepInput>({
    resolver: zodResolver(fulfillmentStepSchema) as Resolver<FulfillmentStepInput>,
    defaultValues: { shippingRegions: [], trackingRequired: false, ...defaultValues },
  });

  async function onSubmit(values: FulfillmentStepInput, saveAndExit: boolean) {
    setFormError(null);
    const result = await saveFulfillmentStepAction(values, { saveAndExit });
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
        <legend className="text-sm font-medium text-ink">Fulfillment model</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MODELS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="radio" value={value} {...register("fulfillmentModel")} className="size-4" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5 sm:w-1/2">
        <Label htmlFor="productionLeadTimeDays">Production lead time (days)</Label>
        <Input id="productionLeadTimeDays" type="number" min={0} {...register("productionLeadTimeDays")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pickupLocationPlaceholder">Pickup location (if applicable)</Label>
        <Input id="pickupLocationPlaceholder" {...register("pickupLocationPlaceholder")} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Shipping regions</legend>
        <div className="flex flex-wrap gap-4">
          {SHIPPING_REGIONS.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted capitalize">
              <input type="checkbox" value={value} {...register("shippingRegions")} className="size-4" />
              {value}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Return policy status</legend>
        <div className="flex flex-wrap gap-4">
          {(["defined", "in_progress", "not_started"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="radio" value={value} {...register("returnPolicyStatus")} className="size-4" />
              {value.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="packagingPreference">Packaging preference</Label>
        <Input id="packagingPreference" {...register("packagingPreference")} />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-muted">
        <input type="checkbox" {...register("trackingRequired")} className="size-4" />
        Tracking numbers required for shipments
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="qcResponsibility">Who&rsquo;s responsible for quality control?</Label>
        <Input id="qcResponsibility" {...register("qcResponsibility")} />
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
