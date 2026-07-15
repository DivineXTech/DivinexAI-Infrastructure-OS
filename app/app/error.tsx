"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center gap-4 py-16 text-center">
      <h2 className="text-lg font-semibold text-ink">This page failed to load</h2>
      <p className="max-w-md text-sm text-ink-muted">
        Try again, or head back to the dashboard.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
