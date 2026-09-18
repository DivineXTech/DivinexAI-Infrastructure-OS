"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";

import { saveProductsStepAction } from "@/app/app/onboarding/wizard-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_CATEGORIES, productsStepSchema, type ProductsStepInput } from "@/lib/validation/onboarding";

const CATEGORY_LABELS: Record<(typeof PRODUCT_CATEGORIES)[number], string> = {
  t_shirts: "T-shirts",
  hoodies: "Hoodies",
  sweatshirts: "Sweatshirts",
  hats: "Hats",
  workwear: "Workwear",
  athletic_apparel: "Athletic apparel",
  childrens_apparel: "Children's apparel",
  bags: "Bags",
  promotional_merchandise: "Promotional merchandise",
  custom_uniforms: "Custom uniforms",
  other: "Other",
};

export function ProductsForm({ defaultValues }: { defaultValues: Partial<ProductsStepInput> }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductsStepInput>({
    resolver: zodResolver(productsStepSchema) as Resolver<ProductsStepInput>,
    defaultValues: { categories: [], ...defaultValues },
  });

  async function onSubmit(values: ProductsStepInput, saveAndExit: boolean) {
    setFormError(null);
    const payload = {
      ...values,
      targetPriceMinCents:
        values.targetPriceMinCents !== undefined ? Math.round(values.targetPriceMinCents * 100) : undefined,
      targetPriceMaxCents:
        values.targetPriceMaxCents !== undefined ? Math.round(values.targetPriceMaxCents * 100) : undefined,
    };
    const result = await saveProductsStepAction(payload, { saveAndExit });
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
        <legend className="text-sm font-medium text-ink">Product categories</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PRODUCT_CATEGORIES.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" value={value} {...register("categories")} className="size-4" />
              {CATEGORY_LABELS[value]}
            </label>
          ))}
        </div>
        {errors.categories ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.categories.message}
          </p>
        ) : null}
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="launchQuantity">Launch quantity (units)</Label>
          <Input id="launchQuantity" type="number" min={0} {...register("launchQuantity")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="initialDesignCount">Number of initial designs</Label>
          <Input id="initialDesignCount" type="number" min={0} {...register("initialDesignCount")} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sizeRange">Size range</Label>
          <Input id="sizeRange" placeholder="e.g. S–3XL" {...register("sizeRange")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="colorRange">Color range</Label>
          <Input id="colorRange" placeholder="e.g. black, white, heather gray" {...register("colorRange")} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="customizationRequirements">Customization requirements</Label>
        <Textarea id="customizationRequirements" rows={3} {...register("customizationRequirements")} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Sales model</legend>
        <div className="flex gap-4">
          {(["retail", "wholesale", "both"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted capitalize">
              <input type="radio" value={value} {...register("salesModel")} className="size-4" />
              {value}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="targetPriceMinCents">Target price — minimum (USD)</Label>
          <Input id="targetPriceMinCents" type="number" min={0} step="0.01" {...register("targetPriceMinCents")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="targetPriceMaxCents">Target price — maximum (USD)</Label>
          <Input id="targetPriceMaxCents" type="number" min={0} step="0.01" {...register("targetPriceMaxCents")} />
          {errors.targetPriceMaxCents ? (
            <p role="alert" className="text-xs text-destructive">
              {errors.targetPriceMaxCents.message}
            </p>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-ink-subtle">
        Enter dollar amounts — these are stored as planning targets, not live pricing.
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
