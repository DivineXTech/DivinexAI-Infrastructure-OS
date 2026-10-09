"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { waitlistFormSchema, type WaitlistFormInput } from "@/lib/validation/schemas";
import { countries } from "@/lib/countries";
import { book, type SupporterActionId } from "@/config/site";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { FieldShell, Input, Select } from "@/components/ui/field";
import { CheckboxField } from "@/components/ui/checkbox";
import { SupporterActions } from "@/components/marketing/supporter-actions";

interface WaitlistFormProps {
  referralCode?: string;
  source?: string;
}

export function WaitlistForm({ referralCode, source = "landing" }: WaitlistFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [renderedAt] = useState(() => Date.now());
  const [actionValues, setActionValues] = useState<Record<SupporterActionId, boolean>>({
    follow: false,
    like: false,
    share: false,
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<WaitlistFormInput>({
    resolver: zodResolver(waitlistFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      country: "",
      marketingConsent: false,
      termsAccepted: undefined,
      socialFollowConfirmed: false,
      socialLikeConfirmed: false,
      socialShareConfirmed: false,
      referralCode: referralCode ?? "",
      source,
      companyWebsite: "",
    },
  });

  useEffect(() => {
    track("waitlist_form_started");
  }, []);

  const allActionsConfirmed = actionValues.follow && actionValues.like && actionValues.share;

  function handleActionToggle(id: SupporterActionId, value: boolean) {
    setActionValues((prev) => ({ ...prev, [id]: value }));
    setValue(
      id === "follow"
        ? "socialFollowConfirmed"
        : id === "like"
          ? "socialLikeConfirmed"
          : "socialShareConfirmed",
      value,
    );
  }

  async function onSubmit(data: WaitlistFormInput) {
    setSubmitError(null);
    track("waitlist_form_submitted");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, formRenderedAtMs: renderedAt }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setSubmitError(payload.error ?? "Something went wrong. Please try again.");
        track("waitlist_signup_error", { reason: payload.error });
        return;
      }

      track("waitlist_signup_success");
      const params = new URLSearchParams({
        name: payload.subscriber.firstName,
        ref: payload.subscriber.referralCode,
        token: payload.chapter12Token,
      });
      router.push(`/thank-you?${params.toString()}`);
    } catch {
      setSubmitError("We couldn't reach the server. Check your connection and try again.");
      track("waitlist_signup_error", { reason: "network" });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8" noValidate>
      <div>
        <h3 className="font-serif-display text-xl text-paper">1. Complete the supporter actions</h3>
        <p className="mt-1 text-sm text-paper-dim">
          Complete the three supporter actions, then join the waitlist to receive{" "}
          {book.earlyAccessChapter}.
        </p>
        <div className="mt-5">
          <SupporterActions values={actionValues} onToggle={handleActionToggle} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-paper-dim/50">
          Social actions may be self-confirmed. Platform verification is not currently performed
          unless explicitly supported by the connected social platform.
        </p>
      </div>

      <div className="gold-divider" />

      <div>
        <h3 className="font-serif-display text-xl text-paper">2. Join the waitlist</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <FieldShell label="First name" htmlFor="firstName" error={errors.firstName?.message}>
            <Input id="firstName" autoComplete="given-name" hasError={!!errors.firstName} {...register("firstName")} />
          </FieldShell>
          <FieldShell label="Last name" htmlFor="lastName" optional error={errors.lastName?.message}>
            <Input id="lastName" autoComplete="family-name" {...register("lastName")} />
          </FieldShell>
          <FieldShell label="Email address" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              hasError={!!errors.email}
              {...register("email")}
            />
          </FieldShell>
          <FieldShell label="Mobile number" htmlFor="phone" optional error={errors.phone?.message}>
            <Input id="phone" type="tel" autoComplete="tel" {...register("phone")} />
          </FieldShell>
          <FieldShell label="Country" htmlFor="country" optional>
            <Select id="country" defaultValue="" {...register("country")}>
              <option value="">Select a country</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </Select>
          </FieldShell>
        </div>

        <input type="hidden" {...register("referralCode")} />
        <input type="hidden" {...register("source")} />
        <div className="hidden" aria-hidden="true">
          <label htmlFor="companyWebsite">Company website</label>
          <input id="companyWebsite" tabIndex={-1} autoComplete="off" {...register("companyWebsite")} />
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <CheckboxField
            id="marketingConsent"
            {...register("marketingConsent")}
            label="Send me launch updates and offers by email. You can unsubscribe anytime."
          />
          <CheckboxField
            id="termsAccepted"
            {...register("termsAccepted")}
            error={errors.termsAccepted?.message}
            label={
              <>
                I accept the{" "}
                <Link href="/early-access-terms" target="_blank" className="text-gold-300 underline underline-offset-2">
                  Early-Access Terms
                </Link>{" "}
                and{" "}
                <Link href="/terms" target="_blank" className="text-gold-300 underline underline-offset-2">
                  Terms of Use
                </Link>
                .
              </>
            }
          />
        </div>
      </div>

      {submitError && (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {submitError}
        </p>
      )}

      <div>
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!allActionsConfirmed || isSubmitting}>
          {isSubmitting ? "Submitting…" : `Join the Waitlist & Unlock ${book.earlyAccessChapter}`}
        </Button>
        {!allActionsConfirmed && (
          <p className="mt-2 text-xs text-paper-dim/60">
            Complete all three supporter actions above to enable the waitlist form.
          </p>
        )}
      </div>
    </form>
  );
}
