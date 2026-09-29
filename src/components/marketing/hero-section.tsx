import Link from "next/link";
import { book } from "@/config/site";
import { CoverArt } from "@/components/marketing/cover-art";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28">
        <div className="order-2 lg:order-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/5 px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.15em] text-gold-300">
            {book.edition} &middot; Pre-Launch
          </span>

          <h1 className="mt-6 font-serif-display text-4xl leading-[1.1] text-paper sm:text-5xl lg:text-6xl">
            <span className="gold-text">{book.title}</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-paper-dim">{book.subtitle}</p>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-paper-dim/80">
            By {book.author}, {book.authorTitle}. Support the launch and receive early access to{" "}
            <span className="text-gold-300">{book.earlyAccessChapter}</span> before the book
            releases.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/join"
              className="focus-gold inline-flex items-center justify-center rounded-md bg-gradient-to-b from-gold-300 to-gold-500 px-7 py-3.5 text-base font-semibold text-ink shadow-[0_8px_24px_-8px_rgba(212,175,55,0.55)] transition-transform hover:scale-[1.01]"
            >
              Join the Waitlist
            </Link>
            <a
              href="#why-early-access"
              className="focus-gold inline-flex items-center justify-center rounded-md border border-white/15 px-7 py-3.5 text-base text-paper-dim transition-colors hover:border-gold-400/40 hover:text-paper"
            >
              Why {book.earlyAccessChapter} first
            </a>
          </div>

          <p className="mt-6 text-xs text-paper-dim/50">
            Free to join. No purchase necessary. Educational content — not a promise of income or
            financial outcome.
          </p>
        </div>

        <div className="order-1 lg:order-2">
          <CoverArt priority />
        </div>
      </div>
    </section>
  );
}
