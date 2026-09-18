"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  confirmStartupKitStepAction,
  generateStartupKitRecommendationAction,
  overrideStartupKitAction,
} from "@/app/app/onboarding/wizard-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StartupKitRecommendationRow } from "@/lib/onboarding/data-access";
import type { StartupKit } from "@/lib/content/startup-kits";

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function StartupKitPanel({
  recommendation,
  kits,
}: {
  recommendation: StartupKitRecommendationRow | null;
  kits: StartupKit[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState(
    recommendation?.userSelectedKitSlug ?? recommendation?.recommendedKitSlug ?? "",
  );

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    const result = await generateStartupKitRecommendationAction();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleOverride() {
    setBusy(true);
    setError(null);
    const result = await overrideStartupKitAction({ selectedKitSlug: selectedSlug });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleContinue() {
    setBusy(true);
    setError(null);
    const result = await confirmStartupKitStepAction();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(result.redirectTo);
    router.refresh();
  }

  if (!recommendation) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">
          We&rsquo;ll generate a recommended startup-kit configuration based on your brand, product, production, and
          budget answers so far. This is planning guidance, not a guarantee of business results.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="button" disabled={busy} onClick={handleGenerate} className="self-start">
          {busy ? "Generating…" : "Generate my recommendation"}
        </Button>
      </div>
    );
  }

  const recommendedKit = kits.find((k) => k.slug === recommendation.recommendedKitSlug);
  const secondaryKit = recommendation.secondaryKitSlug
    ? kits.find((k) => k.slug === recommendation.secondaryKitSlug)
    : null;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{recommendedKit?.name ?? recommendation.recommendedKitSlug}</CardTitle>
            <Badge variant="accent">Score {recommendation.score}/100</Badge>
          </div>
          <CardDescription>{recommendation.explanation}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {recommendation.requiredCategories.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-ink">Required</p>
              <ul className="list-disc pl-5 text-sm text-ink-muted">
                {recommendation.requiredCategories.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {recommendation.ownedItems.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-ink">Already owned</p>
              <ul className="list-disc pl-5 text-sm text-ink-muted">
                {recommendation.ownedItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {recommendation.optionalCategories.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-ink">Optional</p>
              <ul className="list-disc pl-5 text-sm text-ink-muted">
                {recommendation.optionalCategories.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {recommendation.estimatedRange ? (
            <p className="text-sm text-ink-muted">
              Estimated range: {formatCents(recommendation.estimatedRange.minCents)}
              {recommendation.estimatedRange.maxCents
                ? ` – ${formatCents(recommendation.estimatedRange.maxCents)}`
                : "+"}
            </p>
          ) : null}
          <div>
            <p className="text-sm font-medium text-ink">Risks and assumptions</p>
            <ul className="list-disc pl-5 text-sm text-ink-muted">
              {recommendation.risks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-ink">Next steps</p>
            <ul className="list-disc pl-5 text-sm text-ink-muted">
              {recommendation.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-ink-subtle">Rule version {recommendation.ruleVersion}</p>
        </CardContent>
      </Card>

      {secondaryKit ? (
        <p className="text-sm text-ink-muted">
          Alternative to consider: <span className="font-medium text-ink">{secondaryKit.name}</span>
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="kit-select" className="text-sm font-medium text-ink">
          Your final selection
        </label>
        <select
          id="kit-select"
          value={selectedSlug}
          onChange={(event) => setSelectedSlug(event.target.value)}
          className="h-10 w-full max-w-sm rounded-md border border-border-strong bg-surface px-3 text-sm text-ink"
        >
          {kits.map((kit) => (
            <option key={kit.slug} value={kit.slug}>
              {kit.name}
            </option>
          ))}
        </select>
        {recommendation.overridden ? (
          <p className="text-xs text-ink-subtle">
            You&rsquo;ve chosen a different configuration than the recommendation.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={handleOverride}>
            Confirm selection
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={handleGenerate}>
            Recalculate recommendation
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="button" disabled={busy} onClick={handleContinue} className="self-start">
        {busy ? "Saving…" : "Save and continue"}
      </Button>
    </div>
  );
}
