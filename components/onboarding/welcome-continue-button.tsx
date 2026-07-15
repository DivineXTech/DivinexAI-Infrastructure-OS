"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { advanceWelcomeStepAction } from "@/app/app/onboarding/wizard-actions";
import { Button } from "@/components/ui/button";

export function WelcomeContinueButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    const result = await advanceWelcomeStepAction();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(result.redirectTo);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="button" disabled={busy} onClick={handleClick} className="self-start">
        {busy ? "Starting…" : "Get started"}
      </Button>
    </div>
  );
}
