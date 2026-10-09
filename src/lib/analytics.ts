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
  | "chapter12_downloaded"
  | "referral_link_copied"
  | "share_clicked"
  | "status_lookup_requested"
  | "unsubscribe_submitted"
  | "purchase_checkout_started"
  | "purchase_completed";

/**
 * Property keys that commonly carry personal information. `track()` strips
 * them defensively so a future call site can't accidentally leak a
 * subscriber's email/name/phone into PostHog/GA just by naming a property
 * badly — every current call site already avoids these, this is a second
 * layer, not the only one.
 */
const PII_KEY_DENYLIST = new Set([
  "email",
  "firstName",
  "first_name",
  "lastName",
  "last_name",
  "phone",
  "address",
]);

function stripPotentialPii(properties: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (PII_KEY_DENYLIST.has(key)) continue;
    safe[key] = value;
  }
  return safe;
}

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;

  const safeProperties = properties ? stripPotentialPii(properties) : undefined;

  try {
    window.posthog?.capture(event, safeProperties);
    window.gtag?.("event", event, safeProperties);
  } catch (error) {
    console.warn("[analytics] track failed", error);
  }
}
