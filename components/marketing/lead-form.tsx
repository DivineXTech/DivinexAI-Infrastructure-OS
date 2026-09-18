"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitLeadAction } from "@/lib/leads/actions";
import type { LeadType } from "@/lib/leads/types";
import { leadSchema, type LeadInput } from "@/lib/validation/lead";

export function LeadForm({
  leadType,
  source,
  submitLabel = "Submit",
  showMessage = true,
  interestOptions,
  interestLabel = "What are you interested in?",
}: {
  leadType: LeadType;
  source: string;
  submitLabel?: string;
  showMessage?: boolean;
  interestOptions?: string[];
  interestLabel?: string;
}) {
  const searchParams = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: { leadType, consentGiven: false },
  });

  async function onSubmit(values: LeadInput) {
    setFormError(null);
    const result = await submitLeadAction({
      ...values,
      leadType,
      source,
      utmSource: searchParams.get("utm_source") ?? undefined,
      utmMedium: searchParams.get("utm_medium") ?? undefined,
      utmCampaign: searchParams.get("utm_campaign") ?? undefined,
    });

    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div role="status" className="rounded-lg border border-border bg-surface-muted p-6 text-center">
        <p className="font-medium text-ink">Thanks — we&apos;ve got it.</p>
        <p className="mt-1 text-sm text-ink-muted">
          We&apos;ll follow up at the email address you provided.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {/* Honeypot: visually hidden, off-screen (not display:none) so
          form-filling bots are more likely to populate it than skip it.
          Real users never see or reach this field. */}
      <div className="absolute left-[-9999px] opacity-0" aria-hidden="true">
        <label htmlFor="companyWebsite">Company website</label>
        <input
          id="companyWebsite"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register("companyWebsite")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" autoComplete="name" aria-invalid={!!errors.fullName} {...register("fullName")} />
        {errors.fullName ? (
          <p role="alert" className="text-xs text-destructive">{errors.fullName.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        {errors.email ? (
          <p role="alert" className="text-xs text-destructive">{errors.email.message}</p>
        ) : null}
      </div>

      {interestOptions ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="interest">{interestLabel}</Label>
          <select
            id="interest"
            className="flex h-10 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
            {...register("interest")}
          >
            <option value="">Select an option</option>
            {interestOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showMessage ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="message">Message</Label>
          <textarea
            id="message"
            rows={4}
            className="flex w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle"
            {...register("message")}
          />
        </div>
      ) : null}

      <div className="flex items-start gap-2">
        <input
          id="consentGiven"
          type="checkbox"
          className="mt-1 size-4 rounded border-border-strong"
          {...register("consentGiven")}
        />
        <Label htmlFor="consentGiven" className="text-sm font-normal text-ink-muted">
          I agree to be contacted by KushPrintCo OS about my request.
        </Label>
      </div>
      {errors.consentGiven ? (
        <p role="alert" className="text-xs text-destructive">{errors.consentGiven.message}</p>
      ) : null}

      {formError ? (
        <p role="alert" className="text-sm text-destructive">{formError}</p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? "Submitting…" : submitLabel}
      </Button>
    </form>
  );
}
