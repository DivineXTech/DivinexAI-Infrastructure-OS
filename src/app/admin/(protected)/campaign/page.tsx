import { book, social, contact, siteUrl } from "@/config/site";
import { rewardMilestones } from "@/config/rewards";
import {
  isSupabaseConfigured,
  isResendConfigured,
  isAdminPasswordConfigured,
  isStripeConfigured,
  env,
} from "@/lib/env";

export const metadata = { title: "Campaign Settings", robots: { index: false, follow: false } };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-hairline/50 py-2.5 text-sm">
      <span className="text-paper-dim">{label}</span>
      <span className="text-paper">{value}</span>
    </div>
  );
}

export default function AdminCampaignPage() {
  return (
    <div>
      <h1 className="font-serif-display text-2xl text-paper">Campaign settings</h1>
      <p className="mt-2 text-sm text-paper-dim">
        Read-only — these values come from environment variables and{" "}
        <code className="text-gold-300">src/config/site.ts</code>. Change them there/in
        Vercel&apos;s environment variable settings, not here.
      </p>

      <div className="mt-6 glass-panel rounded-xl p-5">
        <h2 className="font-serif-display text-lg text-paper">Book</h2>
        <div className="mt-3">
          <Row label="Title" value={book.title} />
          <Row label="Author" value={book.author} />
          <Row label="Edition" value={book.edition} />
          <Row label="Early-access chapter" value={book.earlyAccessChapterTitle} />
          <Row label="Site URL" value={siteUrl} />
          <Row label="Support email" value={contact.supportEmail} />
        </div>
      </div>

      <div className="mt-6 glass-panel rounded-xl p-5">
        <h2 className="font-serif-display text-lg text-paper">Supporter action destinations</h2>
        <div className="mt-3">
          <Row label="Instagram" value={social.instagram} />
          <Row label="TikTok" value={social.tiktok} />
          <Row label="YouTube" value={social.youtube} />
          <Row label="Facebook" value={social.facebook} />
          <Row label="LinkedIn" value={social.linkedin} />
          <Row label="Launch post" value={social.launchPost} />
          <Row label="Share URL" value={social.shareUrl} />
        </div>
      </div>

      <div className="mt-6 glass-panel rounded-xl p-5">
        <h2 className="font-serif-display text-lg text-paper">Reward milestones</h2>
        <div className="mt-3">
          {rewardMilestones.map((m) => (
            <Row
              key={m.id}
              label={`${m.threshold} referral${m.threshold === 1 ? "" : "s"}`}
              value={`${m.name}${m.autoFulfillable ? " (auto)" : " (admin approval required)"}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 glass-panel rounded-xl p-5">
        <h2 className="font-serif-display text-lg text-paper">Integration status</h2>
        <div className="mt-3">
          <Row label="Supabase" value={isSupabaseConfigured() ? "Configured" : "Not configured"} />
          <Row label="Resend" value={isResendConfigured() ? "Configured" : "Not configured"} />
          <Row label="Admin password" value={isAdminPasswordConfigured() ? "Configured" : "Not configured"} />
          <Row label="Stripe" value={isStripeConfigured() ? "Configured" : "Not configured"} />
          <Row
            label="Checkout (public)"
            value={env.checkoutEnabled ? "Enabled" : "Disabled (NEXT_PUBLIC_CHECKOUT_ENABLED)"}
          />
        </div>
      </div>
    </div>
  );
}
