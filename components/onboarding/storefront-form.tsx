"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";

import { saveStorefrontStepAction } from "@/app/app/onboarding/wizard-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_CATEGORIES, storefrontStepSchema, type StorefrontStepInput } from "@/lib/validation/onboarding";

const PAYMENT_METHODS = ["stripe", "paypal", "cash_app", "venmo", "in_person_cash", "other"] as const;
const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  stripe: "Card payments (Stripe)",
  paypal: "PayPal",
  cash_app: "Cash App",
  venmo: "Venmo",
  in_person_cash: "In-person cash",
  other: "Other",
};

export function StorefrontForm({ defaultValues }: { defaultValues: Partial<StorefrontStepInput> }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<StorefrontStepInput>({
    resolver: zodResolver(storefrontStepSchema) as Resolver<StorefrontStepInput>,
    defaultValues: { featuredCategories: [], plannedPaymentMethods: {}, ...defaultValues },
  });

  async function onSubmit(values: StorefrontStepInput, saveAndExit: boolean) {
    setFormError(null);
    const result = await saveStorefrontStepAction(values, { saveAndExit });
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    router.push(result.redirectTo);
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="storefrontName">Storefront name</Label>
        <Input id="storefrontName" {...register("storefrontName")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="themeDirection">Theme direction</Label>
        <Input id="themeDirection" placeholder="e.g. bold and colorful, clean and minimal" {...register("themeDirection")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="heroMessaging">Hero messaging</Label>
        <Textarea id="heroMessaging" rows={3} {...register("heroMessaging")} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Featured categories</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PRODUCT_CATEGORIES.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" value={value} {...register("featuredCategories")} className="size-4" />
              {value.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Domain status</legend>
        <div className="flex flex-wrap gap-4">
          {(["none", "have_domain", "need_domain"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="radio" value={value} {...register("domainStatus")} className="size-4" />
              {value.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="existingDomain">Existing domain (if any)</Label>
        <Input id="existingDomain" {...register("existingDomain")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contactChannel">Customer contact channel</Label>
        <Input id="contactChannel" placeholder="e.g. email, Instagram DMs" {...register("contactChannel")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="announcementBarText">Announcement bar text</Label>
        <Input id="announcementBarText" {...register("announcementBarText")} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">How will customers get their order?</legend>
        <div className="flex gap-4">
          {(["pickup", "shipping", "both"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted capitalize">
              <input type="radio" value={value} {...register("fulfillmentOffer")} className="size-4" />
              {value}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Planned payment methods</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PAYMENT_METHODS.map((method) => (
            <div key={method} className="flex flex-col gap-1">
              <Label htmlFor={`payment-${method}`}>{PAYMENT_METHOD_LABELS[method]}</Label>
              <select
                id={`payment-${method}`}
                {...register(`plannedPaymentMethods.${method}` as const)}
                className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-ink"
                defaultValue="not_available"
              >
                <option value="not_available">Not available</option>
                <option value="planned">Planned</option>
                <option value="available">Available</option>
                <option value="connected">Connected</option>
              </select>
            </div>
          ))}
        </div>
      </fieldset>

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
