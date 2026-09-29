import { Resend } from "resend";
import { env, isResendConfigured } from "@/lib/env";
import { contact } from "@/config/site";

let cachedClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!isResendConfigured()) return null;
  if (!cachedClient) cachedClient = new Resend(env.resendApiKey);
  return cachedClient;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  delivered: boolean;
  /** True when no RESEND_API_KEY is set and the email was only logged. */
  simulated: boolean;
  error?: string;
}

/**
 * Sends transactional email via Resend. When RESEND_API_KEY is not set
 * (local development), the email is logged to the console instead of
 * thrown away, so the full signup flow remains testable without a Resend
 * account.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getResendClient();

  if (!client) {
    console.warn(
      `[email:simulated] RESEND_API_KEY not set. Would send "${input.subject}" to ${input.to}.\n` +
        `--- text body ---\n${input.text}\n-----------------`,
    );
    return { delivered: false, simulated: true };
  }

  const { error } = await client.emails.send({
    from: contact.fromEmail,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    console.error("[email:error]", error);
    return { delivered: false, simulated: false, error: error.message };
  }

  return { delivered: true, simulated: false };
}
