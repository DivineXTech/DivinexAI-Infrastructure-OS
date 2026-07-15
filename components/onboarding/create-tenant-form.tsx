"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { createTenantAction } from "@/app/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeTenantSlug, createTenantSchema, type CreateTenantInput } from "@/lib/validation/tenant";

export function CreateTenantForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateTenantInput>({ resolver: zodResolver(createTenantSchema) });

  const tenantSlug = watch("tenantSlug") ?? "";

  function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    const name = event.target.value;
    setValue("tenantName", name);
    if (!slugTouched) {
      setValue("tenantSlug", normalizeTenantSlug(name), { shouldValidate: true });
    }
  }

  async function onSubmit(values: CreateTenantInput) {
    setFormError(null);
    const result = await createTenantAction(values);

    if (!result.ok) {
      if (result.field) {
        setError(result.field, { message: result.error });
      } else {
        setFormError(result.error);
      }
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md text-left">
      <CardHeader>
        <CardTitle>Create your brand workspace</CardTitle>
        <CardDescription>
          This creates your tenant and makes you its owner. The full brand
          onboarding wizard (logo, colors, target audience, etc.) ships in
          Phase 3 — this step just gets you a workspace to land in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tenantName">Brand name</Label>
            <Input
              id="tenantName"
              autoComplete="organization"
              aria-invalid={!!errors.tenantName}
              {...register("tenantName", { onChange: handleNameChange })}
            />
            {errors.tenantName ? (
              <p role="alert" className="text-xs text-destructive">
                {errors.tenantName.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tenantSlug">Workspace URL</Label>
            <div className="flex items-center gap-1 text-sm text-ink-subtle">
              <span>/store/</span>
              <Input
                id="tenantSlug"
                aria-invalid={!!errors.tenantSlug}
                {...register("tenantSlug", {
                  onChange: () => setSlugTouched(true),
                })}
                value={tenantSlug}
              />
            </div>
            {errors.tenantSlug ? (
              <p role="alert" className="text-xs text-destructive">
                {errors.tenantSlug.message}
              </p>
            ) : null}
          </div>

          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <Button type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? "Creating…" : "Create workspace"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
