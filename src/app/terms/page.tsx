import type { Metadata } from "next";
import { LegalPageShell } from "@/components/layout/legal-page-shell";
import { book, contact, legal } from "@/config/site";

export const metadata: Metadata = { title: "Terms of Use" };

const UPDATED_AT = "July 22, 2026";

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Use" updatedAt={UPDATED_AT}>
      <p>
        These Terms of Use (&quot;Terms&quot;) govern your access to and use of the {book.title}{" "}
        waitlist website (the &quot;Site&quot;), operated by {legal.companyName}. By using the
        Site, you agree to these Terms.
      </p>

      <h2>Eligibility</h2>
      <p>
        You must be at least 16 years old to join the waitlist. By submitting the waitlist form,
        you represent that the information you provide is accurate.
      </p>

      <h2>No guarantee of income or outcome</h2>
      <p>
        {book.title} is educational and strategic content. Nothing on this Site, in the book, or
        in Chapter 12 constitutes financial, legal, tax, or investment advice, and no specific
        income, results, or financial outcome is promised or guaranteed. Individual results vary
        based on effort, market conditions, and factors outside our control.
      </p>

      <h2>Supporter actions and self-attestation</h2>
      <p>
        The Follow, Like, and Share supporter actions are confirmed by you, the visitor. Unless a
        connected social platform explicitly supports it, we do not technically verify that these
        actions were completed. Misrepresenting completion of supporter actions may result in
        removal from the waitlist or revocation of early-access benefits.
      </p>

      <h2>Intellectual property</h2>
      <p>
        All content on this Site, including the book cover, chapter excerpts, and branding, is
        owned by {legal.companyName} or its licensors and is protected by copyright and other
        intellectual property laws. You may not reproduce, distribute, or create derivative works
        from this content without written permission.
      </p>

      <h2>Referral program</h2>
      <p>
        Referral links and any associated rewards are provided at {legal.companyName}&apos;s sole
        discretion and may be modified, paused, or discontinued at any time. We reserve the right
        to disqualify referrals we reasonably believe are fraudulent or abusive.
      </p>

      <h2>Acceptable use</h2>
      <p>
        You agree not to misuse the Site, including attempting to submit fraudulent waitlist
        entries, interfere with the Site&apos;s operation, or circumvent rate limiting or abuse
        prevention measures.
      </p>

      <h2>Disclaimer of warranties</h2>
      <p>
        The Site and its content are provided &quot;as is&quot; without warranties of any kind,
        express or implied, to the fullest extent permitted by law.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, {legal.companyName} is not liable for any
        indirect, incidental, or consequential damages arising from your use of the Site.
      </p>

      <h2>Changes to these Terms</h2>
      <p>We may update these Terms from time to time. Continued use of the Site after changes constitutes acceptance.</p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms can be sent to{" "}
        <a href={`mailto:${contact.supportEmail}`}>{contact.supportEmail}</a>.
      </p>
    </LegalPageShell>
  );
}
