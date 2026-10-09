// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "@/lib/analytics";

afterEach(() => {
  delete window.posthog;
  delete window.gtag;
});

describe("analytics.track", () => {
  it("forwards events to posthog and gtag when present", () => {
    const capture = vi.fn();
    const gtag = vi.fn();
    window.posthog = { capture };
    window.gtag = gtag;

    track("waitlist_signup_success");

    expect(capture).toHaveBeenCalledWith("waitlist_signup_success", undefined);
    expect(gtag).toHaveBeenCalledWith("event", "waitlist_signup_success", undefined);
  });

  it("strips common PII keys from event properties before sending", () => {
    const capture = vi.fn();
    window.posthog = { capture };

    track("waitlist_signup_error", {
      reason: "network",
      email: "someone@example.com",
      firstName: "Ada",
      phone: "555-1234",
    });

    expect(capture).toHaveBeenCalledWith("waitlist_signup_error", { reason: "network" });
  });

  it("does nothing (and does not throw) when no provider is configured", () => {
    expect(() => track("landing_view")).not.toThrow();
  });

  it("swallows a throwing provider instead of crashing the caller", () => {
    window.posthog = {
      capture: () => {
        throw new Error("provider exploded");
      },
    };
    expect(() => track("landing_view")).not.toThrow();
  });
});
