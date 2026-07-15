"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { removeBrandLogoAction, saveBrandStepAction, uploadBrandLogoAction } from "@/app/app/onboarding/wizard-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BRAND_PERSONALITIES, brandStepSchema, type BrandStepInput } from "@/lib/validation/onboarding";

const PERSONALITY_LABELS: Record<(typeof BRAND_PERSONALITIES)[number], string> = {
  luxury: "Luxury",
  streetwear: "Streetwear",
  athletic: "Athletic",
  professional: "Professional",
  youth: "Youth",
  faith_based: "Faith-based",
  lifestyle: "Lifestyle",
  workwear: "Workwear",
  custom: "Something else",
};

export function BrandForm({ defaultValues }: { defaultValues: Partial<BrandStepInput> }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(defaultValues.logoPath || null);
  const [logoBusy, setLogoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BrandStepInput>({
    resolver: zodResolver(brandStepSchema),
    defaultValues,
  });

  async function onSubmit(values: BrandStepInput, saveAndExit: boolean) {
    setFormError(null);
    const result = await saveBrandStepAction({ ...values, logoPath: logoPath ?? "" }, { saveAndExit });
    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof BrandStepInput, { message });
        }
      }
      setFormError(result.error);
      return;
    }
    router.push(result.redirectTo);
    router.refresh();
  }

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoBusy(true);
    setFormError(null);
    const formData = new FormData();
    formData.set("logo", file);
    const result = await uploadBrandLogoAction(formData);
    setLogoBusy(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setLogoPath(result.path);
  }

  async function handleLogoRemove() {
    setLogoBusy(true);
    await removeBrandLogoAction();
    setLogoBusy(false);
    setLogoPath(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <form className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brandName">Brand name</Label>
        <Input id="brandName" aria-invalid={!!errors.brandName} {...register("brandName")} />
        {errors.brandName ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.brandName.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tagline">Tagline</Label>
        <Input id="tagline" {...register("tagline")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Brand description</Label>
        <Textarea id="description" rows={4} {...register("description")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="logo-input">Logo</Label>
        {logoPath ? (
          <div className="flex items-center gap-3 text-sm text-ink-muted">
            <span>Logo uploaded.</span>
            <Button type="button" variant="outline" size="sm" onClick={handleLogoRemove} disabled={logoBusy}>
              Remove
            </Button>
          </div>
        ) : (
          <input
            id="logo-input"
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleLogoChange}
            disabled={logoBusy}
            className="text-sm text-ink-muted"
          />
        )}
        <p className="text-xs text-ink-subtle">PNG, JPEG, or WebP. Max 5 MB.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="primaryColor">Primary color</Label>
          <Input id="primaryColor" type="text" placeholder="#111111" {...register("primaryColor")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="secondaryColor">Secondary color</Label>
          <Input id="secondaryColor" type="text" placeholder="#ffffff" {...register("secondaryColor")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="accentColor">Accent color</Label>
          <Input id="accentColor" type="text" placeholder="#c9a227" {...register("accentColor")} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="typography">Typography direction</Label>
        <Input id="typography" placeholder="e.g. bold sans-serif" {...register("typography")} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Brand personality</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BRAND_PERSONALITIES.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="radio" value={value} {...register("personality")} className="size-4" />
              {PERSONALITY_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="personalityOther">Describe it, if &ldquo;something else&rdquo;</Label>
        <Input id="personalityOther" {...register("personalityOther")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="existingWebsite">Existing website (if any)</Label>
        <Input id="existingWebsite" {...register("existingWebsite")} />
      </div>

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit((values) => onSubmit(values, false))}
        >
          {isSubmitting ? "Saving…" : "Save and continue"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={handleSubmit((values) => onSubmit(values, true))}
        >
          Save and exit
        </Button>
      </div>
    </form>
  );
}
