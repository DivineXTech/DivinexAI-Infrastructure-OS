import { z } from "zod";

import { LEAD_TYPES } from "@/lib/leads/types";

export const leadSchema = z.object({
  leadType: z.enum(LEAD_TYPES),
  fullName: z.string().min(1, "Name is required").max(160),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  message: z.string().max(2000).optional().or(z.literal("")),
  consentGiven: z
    .boolean()
    .refine((v) => v === true, "Please confirm you agree to be contacted"),
  interest: z.string().max(160).optional().or(z.literal("")),
  source: z.string().max(160).optional(),
  utmSource: z.string().max(160).optional(),
  utmMedium: z.string().max(160).optional(),
  utmCampaign: z.string().max(160).optional(),
  /** Honeypot — real visitors never see or fill this field (hidden via
   * CSS, not `type="hidden"`, so form-filling bots are more likely to
   * populate it). Checked in lib/leads/spam-prevention.ts, not here, so a
   * bot trip produces a fake success rather than a validation error that
   * would teach it which field to leave blank next time. */
  companyWebsite: z.string().optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;
