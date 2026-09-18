import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { isStepAccessible, type StepProgressRow } from "@/lib/onboarding/progress";
import { STEPS, type StepKey } from "@/lib/onboarding/steps";
import { cn } from "@/lib/utils";

type WizardShellProps = {
  currentStep: StepKey;
  stepProgress: StepProgressRow[];
  completionPercentage: number;
  children: React.ReactNode;
};

/**
 * Shared shell for every onboarding wizard step page: progress bar, step
 * nav (completed steps stay clickable so founders can go back and edit;
 * locked future steps render as plain text, not links, so the UI can't
 * offer a path the server-side guard would reject anyway), and the
 * step's own form/content in `children`.
 */
export function WizardShell({
  currentStep,
  stepProgress,
  completionPercentage,
  children,
}: WizardShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:flex-row">
      <nav
        aria-label="Onboarding steps"
        className="flex flex-col gap-4 lg:w-64 lg:shrink-0"
      >
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-ink-muted">
            <span>Onboarding progress</span>
            <span>{completionPercentage}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={completionPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Onboarding completion"
            className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
          >
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        <ol className="flex flex-col gap-1">
          {STEPS.map((step) => {
            const progressRow = stepProgress.find((p) => p.stepKey === step.key);
            const status = progressRow?.status ?? "not_started";
            const accessible = isStepAccessible(step.key, stepProgress);
            const isCurrent = step.key === currentStep;

            const content = (
              <div
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm",
                  isCurrent && "bg-surface-muted font-medium text-ink",
                  !isCurrent && accessible && "text-ink-muted hover:bg-surface-muted",
                  !accessible && "text-ink-subtle",
                )}
              >
                <span>{step.label}</span>
                {status === "completed" ? (
                  <Badge variant="success">Done</Badge>
                ) : isCurrent ? (
                  <Badge variant="accent">Current</Badge>
                ) : !accessible ? (
                  <Badge variant="outline">Locked</Badge>
                ) : null}
              </div>
            );

            return (
              <li key={step.key}>
                {accessible ? (
                  <Link href={step.href} aria-current={isCurrent ? "step" : undefined}>
                    {content}
                  </Link>
                ) : (
                  <div aria-disabled="true">{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
