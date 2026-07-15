"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";

import { saveProductionStepAction } from "@/app/app/onboarding/wizard-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { productionStepSchema, type ProductionStepInput } from "@/lib/validation/onboarding";

const METHODS = [
  ["heat_transfer_vinyl", "Heat transfer vinyl"],
  ["dtf", "Direct-to-film (DTF)"],
  ["sublimation", "Sublimation"],
  ["screen_printing", "Screen printing"],
  ["embroidery", "Embroidery"],
  ["outsourced", "Outsourced to a supplier"],
  ["hybrid", "Hybrid / more than one method"],
] as const;

const EXPERIENCE = [
  ["new", "New to production"],
  ["some_experience", "Some experience"],
  ["experienced", "Experienced"],
] as const;

const WORKSPACES = [
  ["none", "No dedicated workspace yet"],
  ["mobile", "Mobile / portable setup"],
  ["shared_space", "Shared space"],
  ["home_dedicated", "Dedicated space at home"],
  ["commercial", "Commercial space"],
] as const;

export function ProductionForm({ defaultValues }: { defaultValues: Partial<ProductionStepInput> }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ProductionStepInput>({
    resolver: zodResolver(productionStepSchema) as Resolver<ProductionStepInput>,
    defaultValues: { equipmentOwned: false, ...defaultValues },
  });

  async function onSubmit(values: ProductionStepInput, saveAndExit: boolean) {
    setFormError(null);
    const result = await saveProductionStepAction(values, { saveAndExit });
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
        <legend className="text-sm font-medium text-ink">Preferred production method</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {METHODS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="radio" value={value} {...register("preferredMethod")} className="size-4" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Experience level</legend>
        <div className="flex flex-wrap gap-4">
          {EXPERIENCE.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="radio" value={value} {...register("experienceLevel")} className="size-4" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Workspace</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {WORKSPACES.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="radio" value={value} {...register("workspace")} className="size-4" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5 sm:w-1/2">
        <Label htmlFor="expectedMonthlyVolume">Expected monthly order volume</Label>
        <Input id="expectedMonthlyVolume" type="number" min={0} {...register("expectedMonthlyVolume")} />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-muted">
        <input type="checkbox" {...register("equipmentOwned")} className="size-4" />
        I already own production equipment
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="existingEquipment">Existing equipment (if any)</Label>
        <Textarea id="existingEquipment" rows={3} {...register("existingEquipment")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="outsourcingPreference">Outsourcing preferences (if any)</Label>
        <Textarea id="outsourcingPreference" rows={3} {...register("outsourcingPreference")} />
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
