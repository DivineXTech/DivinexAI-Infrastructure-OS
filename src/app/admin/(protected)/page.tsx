import { getSubscriberStore } from "@/lib/store/subscriber-store";
import { getRewardStore } from "@/lib/store/reward-store";
import { getEmailLogStore } from "@/lib/store/email-log-store";
import { isSupabaseConfigured, isResendConfigured } from "@/lib/env";

export const metadata = { title: "Admin Overview", robots: { index: false, follow: false } };

async function getStats() {
  const subscriberStore = getSubscriberStore();
  const rewardStore = getRewardStore();
  const emailLogStore = getEmailLogStore();

  const [totalSubscribers, chapter12Accessed, pendingRewards, recentEmails] = await Promise.all([
    subscriberStore.countAll(),
    subscriberStore.countChapter12Accessed(),
    rewardStore.listAll({ status: "pending_review", limit: 1, offset: 0 }),
    emailLogStore.list({ limit: 20, offset: 0 }),
  ]);

  const recentFailures = recentEmails.entries.filter((e) => !e.delivered && !e.simulated).length;

  return {
    totalSubscribers,
    chapter12Accessed,
    pendingRewardsCount: pendingRewards.total,
    recentEmailCount: recentEmails.entries.length,
    recentFailures,
  };
}

function StatCard({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const Wrapper = href ? "a" : "div";
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className="glass-panel block rounded-xl p-5 transition-colors hover:border-gold-400/30"
    >
      <p className="text-xs uppercase tracking-wider text-paper-dim/60">{label}</p>
      <p className="mt-2 font-serif-display text-2xl text-paper">{value}</p>
    </Wrapper>
  );
}

export default async function AdminOverviewPage() {
  const stats = await getStats();

  return (
    <div>
      <h1 className="font-serif-display text-2xl text-paper">Overview</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total subscribers" value={stats.totalSubscribers} href="/admin/subscribers" />
        <StatCard label="Chapter 12 opened" value={stats.chapter12Accessed} />
        <StatCard
          label="Rewards pending review"
          value={stats.pendingRewardsCount}
          href="/admin/rewards"
        />
        <StatCard
          label="Email failures (last 20)"
          value={stats.recentFailures}
          href="/admin/logs"
        />
      </div>

      <div className="mt-8 glass-panel rounded-xl p-5">
        <h2 className="font-serif-display text-lg text-paper">Integration status</h2>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-paper-dim">Supabase (persistence)</dt>
            <dd className={isSupabaseConfigured() ? "text-gold-300" : "text-rose-400"}>
              {isSupabaseConfigured() ? "Configured" : "Not configured — using in-memory store"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-paper-dim">Resend (email)</dt>
            <dd className={isResendConfigured() ? "text-gold-300" : "text-rose-400"}>
              {isResendConfigured() ? "Configured" : "Not configured — emails are simulated"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
