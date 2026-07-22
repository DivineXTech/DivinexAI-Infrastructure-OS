"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { track, type AnalyticsEvent } from "@/lib/analytics";

interface EmailGateFormProps {
  endpoint: "/api/status" | "/api/unsubscribe";
  buttonLabel: string;
  placeholder?: string;
  trackEvent: AnalyticsEvent;
}

export function EmailGateForm({ endpoint, buttonLabel, placeholder, trackEvent }: EmailGateFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    track(trackEvent);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error ?? "Something went wrong. Please try again.");
        return;
      }

      setStatus("done");
      setMessage(payload.message ?? "Done.");
    } catch {
      setStatus("error");
      setMessage("We couldn't reach the server. Check your connection and try again.");
    }
  }

  if (status === "done") {
    return (
      <p className="rounded-md border border-gold-400/30 bg-gold-400/5 px-4 py-3 text-sm text-gold-200">
        {message}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <Input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={placeholder ?? "you@example.com"}
          aria-label="Email address"
          className="sm:flex-1"
        />
        <Button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : buttonLabel}
        </Button>
      </form>
      {status === "error" && message && <p className="text-sm text-rose-400">{message}</p>}
    </div>
  );
}
