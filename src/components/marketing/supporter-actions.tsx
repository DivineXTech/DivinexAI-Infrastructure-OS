"use client";

import { supporterActions, type SupporterActionId } from "@/config/site";
import { track } from "@/lib/analytics";
import { CheckboxField } from "@/components/ui/checkbox";

interface SupporterActionsProps {
  values: Record<SupporterActionId, boolean>;
  onToggle: (id: SupporterActionId, value: boolean) => void;
}

export function SupporterActions({ values, onToggle }: SupporterActionsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {supporterActions.map((action, index) => (
        <div key={action.id} className="glass-panel flex flex-col gap-4 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold-400/40 font-serif-display text-sm text-gold-300">
              {index + 1}
            </span>
            <h3 className="font-serif-display text-lg text-paper">{action.label}</h3>
          </div>
          <p className="min-h-10 text-sm text-paper-dim">{action.description}</p>
          <a
            href={action.href}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => track("supporter_action_opened", { action: action.id })}
            className="focus-gold inline-flex items-center justify-center rounded-md border border-gold-400/40 px-4 py-2.5 text-sm font-medium text-gold-300 transition-colors hover:bg-gold-400/10"
          >
            {action.cta}
          </a>
          <CheckboxField
            id={`supporter-action-${action.id}`}
            checked={values[action.id]}
            onChange={(event) => {
              onToggle(action.id, event.target.checked);
              track("supporter_action_confirmed", {
                action: action.id,
                confirmed: event.target.checked,
              });
            }}
            label="I've completed this action"
          />
        </div>
      ))}
    </div>
  );
}
