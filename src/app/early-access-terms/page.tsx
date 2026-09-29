import type { Metadata } from "next";
import { LegalPageShell } from "@/components/layout/legal-page-shell";
import { book, contact, legal } from "@/config/site";

export const metadata: Metadata = { title: "Early-Access Terms" };

const UPDATED_AT = "July 22, 2026";

export default function EarlyAccessTermsPage() {
  return (
    <LegalPageShell title={`${book.earlyAccessChapter} Early-Access Terms`} updatedAt={UPDATED_AT}>
      <p>
        These Early-Access Terms govern your access to {book.earlyAccessChapterTitle}, provided
        to waitlist subscribers ahead of the general release of {book.title} (the &quot;Early
        Access Offer&quot;).
      </p>

      <h2>What you receive</h2>
      <p>
        Upon joining the waitlist and confirming the supporter actions, you will receive a
        personal, secure link granting access to {book.earlyAccessChapter}. This link is unique
        to you and should not be shared or published publicly.
      </p>

      <h2>Eligibility</h2>
      <ul>
        <li>You must submit accurate contact information.</li>
        <li>
          You must self-confirm completion of the Follow, Like, and Share supporter actions
          described on the waitlist form.
        </li>
        <li>You must accept these Early-Access Terms and our Terms of Use.</li>
      </ul>

      <h2>License to the early-access content</h2>
      <p>
        We grant you a limited, non-exclusive, non-transferable, revocable license to read{" "}
        {book.earlyAccessChapter} for your personal, non-commercial use. You may not copy,
        republish, sell, or distribute the chapter content.
      </p>

      <h2>No guarantee of final content</h2>
      <p>
        {book.earlyAccessChapter} is provided as an early preview. The final published version of
        {" "}{book.title} may differ from the early-access excerpt as a result of editing,
        revision, or restructuring prior to release.
      </p>

      <h2>Revocation</h2>
      <p>
        {legal.companyName} may revoke early access at its discretion, including in cases of
        suspected abuse, fraudulent supporter-action attestations, or violation of these Terms.
      </p>

      <h2>No income or outcome guarantee</h2>
      <p>
        As with the full book, {book.earlyAccessChapter} is educational and strategic content.
        It is not financial, legal, or investment advice, and no specific income or outcome is
        promised or guaranteed.
      </p>

      <h2>Referral rewards</h2>
      <p>
        Any referral rewards associated with the Early Access Offer will be described at the time
        they are announced and are subject to {legal.companyName}&apos;s discretion, including
        eligibility criteria and fraud review.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about the Early Access Offer can be sent to{" "}
        <a href={`mailto:${contact.supportEmail}`}>{contact.supportEmail}</a>.
      </p>
    </LegalPageShell>
  );
}
