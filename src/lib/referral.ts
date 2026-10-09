import { customAlphabet } from "nanoid";

/**
 * Unambiguous uppercase alphabet (no 0/O, 1/I) so codes are easy to read
 * aloud, type from a screenshot, or print on a card.
 */
const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REFERRAL_CODE_LENGTH = 8;

const generate = customAlphabet(REFERRAL_ALPHABET, REFERRAL_CODE_LENGTH);

export function generateReferralCode(): string {
  return generate();
}

export function isValidReferralCodeFormat(code: string): boolean {
  if (code.length !== REFERRAL_CODE_LENGTH) return false;
  return [...code.toUpperCase()].every((char) => REFERRAL_ALPHABET.includes(char));
}

export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase();
}
