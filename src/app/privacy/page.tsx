import type { Metadata } from "next";
import { LegalPageShell } from "@/components/layout/legal-page-shell";
import { book, contact, legal } from "@/config/site";

export const metadata: Metadata = { title: "Privacy Policy" };

const UPDATED_AT = "July 22, 2026";

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" updatedAt={UPDATED_AT}>
      <p>
        {legal.companyName} (&quot;{legal.companyName}&quot;, &quot;we&quot;, &quot;us&quot;)
        operates the early-access waitlist for {book.title} (the &quot;Site&quot;). This policy
        explains what information we collect, how we use it, and the choices you have.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Information you provide:</strong> first name, last name (optional), email
          address, mobile number (optional), and country (optional) when you join the waitlist.
        </li>
        <li>
          <strong>Self-attested actions:</strong> whether you indicate you&apos;ve completed the
          Follow, Like, and Share supporter actions.
        </li>
        <li>
          <strong>Technical data:</strong> IP address (hashed for abuse prevention, never stored
          in plaintext), user agent, and basic analytics events (e.g. page views, form
          interactions) if analytics is enabled for this deployment.
        </li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>To create and manage your waitlist entry and referral code.</li>
        <li>To send your Chapter 12 early-access link and waitlist confirmation email.</li>
        <li>To send launch updates, if you opted in to marketing communications.</li>
        <li>To detect and prevent spam, abuse, and duplicate submissions.</li>
        <li>To measure and improve the performance of this launch campaign.</li>
      </ul>

      <h2>Legal basis and consent</h2>
      <p>
        Where required by law, we rely on your consent for marketing communications (which you
        can withdraw at any time via the unsubscribe link in every email or the{" "}
        <a href="/unsubscribe">unsubscribe page</a>), and legitimate interest for operating the
        waitlist and preventing fraud.
      </p>

      <h2>Third-party services</h2>
      <p>
        We use the following categories of service providers to operate this Site. Only the
        minimum data necessary is shared with each:
      </p>
      <ul>
        <li>
          <strong>Database hosting (Supabase):</strong> stores your waitlist record.
        </li>
        <li>
          <strong>Transactional email (Resend):</strong> delivers confirmation and access-link
          emails.
        </li>
        <li>
          <strong>Hosting (Vercel):</strong> serves the Site and may log standard request data.
        </li>
        <li>
          <strong>Analytics (optional, Vercel Analytics / PostHog / Google Analytics):</strong>{" "}
          aggregate, privacy-conscious usage metrics, only if configured for this deployment.
        </li>
      </ul>

      <h2>Data retention</h2>
      <p>
        We retain waitlist records for as long as needed to operate the launch campaign and
        communicate about the book&apos;s release, or until you request deletion.
      </p>

      <h2>Your rights</h2>
      <p>
        You may request access to, correction of, or deletion of your data, and you may
        unsubscribe from marketing email at any time, by contacting{" "}
        <a href={`mailto:${contact.supportEmail}`}>{contact.supportEmail}</a> or using the{" "}
        <a href="/unsubscribe">unsubscribe page</a>.
      </p>

      <h2>Children&apos;s privacy</h2>
      <p>This Site is not directed to children under 16, and we do not knowingly collect their data.</p>

      <h2>Contact</h2>
      <p>
        Questions about this policy can be sent to{" "}
        <a href={`mailto:${contact.supportEmail}`}>{contact.supportEmail}</a>.
      </p>
    </LegalPageShell>
  );
}
