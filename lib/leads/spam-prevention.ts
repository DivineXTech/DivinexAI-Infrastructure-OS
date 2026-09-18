import "server-only";

/**
 * Spam-prevention is behind an interface so the honeypot check can be
 * swapped for (or combined with) a real provider — hCaptcha, Turnstile,
 * rate-limiting by IP — without touching call sites in
 * lib/leads/actions.ts. Only the honeypot is implemented today.
 */
export interface SpamCheck {
  /** Returns true if the submission looks like spam and should be
   * silently dropped (fake success, no DB row). */
  isSpam(input: { honeypotValue?: string }): boolean;
}

class HoneypotSpamCheck implements SpamCheck {
  isSpam(input: { honeypotValue?: string }): boolean {
    return !!input.honeypotValue && input.honeypotValue.trim().length > 0;
  }
}

export function getSpamCheck(): SpamCheck {
  return new HoneypotSpamCheck();
}
