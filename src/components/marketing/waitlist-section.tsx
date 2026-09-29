import { book } from "@/config/site";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

export function WaitlistSection({
  referralCode,
  source,
  compact = false,
}: {
  referralCode?: string;
  source?: string;
  compact?: boolean;
}) {
  return (
    <section id="join" className={compact ? "" : "border-t border-hairline"}>
      <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
        {!compact && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-gold-300">
              Early access
            </span>
            <h2 className="mt-4 font-serif-display text-3xl text-paper sm:text-4xl">
              Support the launch, unlock {book.earlyAccessChapter}
            </h2>
          </div>
        )}
        <div className="glass-panel rounded-2xl p-6 sm:p-10">
          <WaitlistForm referralCode={referralCode} source={source} />
        </div>
      </div>
    </section>
  );
}
