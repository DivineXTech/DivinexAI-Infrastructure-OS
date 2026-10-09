"use client";

import { useState } from "react";
import { book, siteUrl } from "@/config/site";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";

export function ReferralShareWidget({ referralCode }: { referralCode: string }) {
  const [copied, setCopied] = useState(false);
  const referralUrl = `${siteUrl}/referral/${referralCode}`;
  const shareMessage = `I just joined the early-access waitlist for ${book.title} by ${book.author}. Join me and unlock ${book.earlyAccessChapter} early:`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      track("referral_link_copied");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  const shareTargets = [
    {
      label: "X / Twitter",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(referralUrl)}`,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralUrl)}`,
    },
    {
      label: "Email",
      href: `mailto:?subject=${encodeURIComponent(`Join me on the ${book.title} waitlist`)}&body=${encodeURIComponent(`${shareMessage}\n\n${referralUrl}`)}`,
    },
  ];

  return (
    <div className="glass-panel rounded-xl p-6">
      <p className="text-sm font-medium text-paper-dim">Your referral link</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <code className="flex-1 truncate rounded-md border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-gold-200">
          {referralUrl}
        </code>
        <Button type="button" variant="outline" onClick={handleCopy}>
          {copied ? "Copied!" : "Copy link"}
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {shareTargets.map((target) => (
          <a
            key={target.label}
            href={target.href}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => track("share_clicked", { target: target.label })}
            className="focus-gold rounded-md border border-white/10 px-3.5 py-2 text-xs font-medium text-paper-dim transition-colors hover:border-gold-400/40 hover:text-paper"
          >
            Share on {target.label}
          </a>
        ))}
      </div>
    </div>
  );
}
