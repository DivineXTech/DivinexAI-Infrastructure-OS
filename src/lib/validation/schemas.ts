import { z } from "zod";

/**
 * Loose E.164-ish phone check. Intentionally permissive since this field is
 * optional and we never send SMS from it in this version — it's collected
 * for future outreach only.
 */
const phoneRegex = /^[0-9+()\-.\s]{7,20}$/;

export const waitlistFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required.")
    .max(80, "First name is too long."),
  lastName: z.string().trim().max(80, "Last name is too long.").optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, "Enter a valid phone number.")
    .optional()
    .or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  marketingConsent: z.boolean(),
  termsAccepted: z.literal(true, {
    error: "You must accept the Early-Access Terms to continue.",
  }),
  socialFollowConfirmed: z.boolean(),
  socialLikeConfirmed: z.boolean(),
  socialShareConfirmed: z.boolean(),
  referralCode: z.string().trim().max(16).optional().or(z.literal("")),
  source: z.string().trim().max(40).optional(),
  /** Honeypot: real visitors never fill this in. Bots frequently do. */
  companyWebsite: z.string().max(0, "Spam detected.").optional().or(z.literal("")),
  /** Milliseconds the form was visible before submit; used for basic bot heuristics. */
  formRenderedAtMs: z.number().optional(),
});

export type WaitlistFormInput = z.infer<typeof waitlistFormSchema>;

export const statusRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export type StatusRequestInput = z.infer<typeof statusRequestSchema>;

export const unsubscribeRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export type UnsubscribeRequestInput = z.infer<typeof unsubscribeRequestSchema>;
