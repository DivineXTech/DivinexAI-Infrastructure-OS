"use client";

/**
 * Provider-agnostic event tracking. Ships as a no-op until either PostHog
 * or GA4 credentials are configured, so the funnel can be instrumented now
 * and wired to a real provider later without touching call sites.
 */

declare global {
  interface Window {
    posthog?: { capture: (event: string, properties?: Record<string, unknown>) => void };
    gtag?: (...args: unknown[]) => void;
  }
}

export type AnalyticsEvent =
  | "landing_view"
  | "supporter_action_opened"
  | "supporter_action_confirmed"
  | "waitlist_form_started"
  | "waitlist_form_submitted"
  | "waitlist_signup_success"
  | "waitlist_signup_error"
  | "chapter12_viewed"
  | "referral_link_copied"
  | "share_clicked"
  | "status_lookup_requested"
  | "unsubscribe_submitted";

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;

  try {
    window.posthog?.capture(event, properties);
    window.gtag?.("event", event, properties);
  } catch (error) {
    console.warn("[analytics] track failed", error);
  }
}
