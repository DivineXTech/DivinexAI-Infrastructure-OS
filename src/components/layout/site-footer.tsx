import Link from "next/link";
import { book, legal, social } from "@/config/site";

const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Use" },
  { href: "/early-access-terms", label: "Early-Access Terms" },
  { href: "/unsubscribe", label: "Unsubscribe" },
];

const socialLinks = [
  { href: social.instagram, label: "Instagram" },
  { href: social.tiktok, label: "TikTok" },
  { href: social.youtube, label: "YouTube" },
  { href: social.facebook, label: "Facebook" },
  { href: social.linkedin, label: "LinkedIn" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <p className="font-serif-display text-base text-paper">{book.title}</p>
            <p className="mt-1 text-sm text-paper-dim/70">
              {book.publisher}, {book.publisherLocation}
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:items-end">
            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-paper-dim">
              {legalLinks.map((link) => (
                <Link key={link.href} href={link.href} className="focus-gold hover:text-gold-300">
                  {link.label}
                </Link>
              ))}
            </nav>
            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-wider text-paper-dim/60">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="focus-gold hover:text-gold-300"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
        <div className="gold-divider mt-8" />
        <p className="mt-6 text-xs text-paper-dim/50">
          &copy; {new Date().getFullYear()} {legal.companyName}. All rights reserved. Results
          discussed are educational and strategic in nature and are not a guarantee of income or
          financial outcome.
        </p>
      </div>
    </footer>
  );
}
