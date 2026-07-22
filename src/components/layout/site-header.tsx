import Link from "next/link";
import { book } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex flex-col leading-none focus-gold rounded-sm">
          <span className="font-serif-display text-lg text-paper">
            The Billionaire <span className="gold-text">Blueprint</span>
          </span>
          <span className="text-[10px] tracking-[0.2em] text-paper-dim/70 uppercase">
            {book.edition} &middot; {book.author}
          </span>
        </Link>
        <Link
          href="/join"
          className="focus-gold rounded-md border border-gold-400/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gold-300 transition-colors hover:bg-gold-400/10 sm:text-sm"
        >
          Join the Waitlist
        </Link>
      </div>
    </header>
  );
}
