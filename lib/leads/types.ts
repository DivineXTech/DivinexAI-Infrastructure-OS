export const LEAD_TYPES = [
  "general_contact",
  "consultation_request",
  "startup_kit_interest",
  "equipment_interest",
  "white_label_interest",
  "early_access_signup",
] as const;

export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_TYPE_LABEL: Record<LeadType, string> = {
  general_contact: "General contact",
  consultation_request: "Consultation request",
  startup_kit_interest: "Startup-kit interest",
  equipment_interest: "Equipment interest",
  white_label_interest: "White-label interest",
  early_access_signup: "Early-access signup",
};
