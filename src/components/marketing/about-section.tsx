import { book } from "@/config/site";

const pillars = [
  {
    title: "AI-enabled wealth creation",
    body: "How builders are using AI as leverage, not just a tool — to design systems that generate value continuously.",
  },
  {
    title: "Ownership over dependence",
    body: "The shift from trading time for a paycheck to owning the infrastructure that produces income.",
  },
  {
    title: "Infrastructure-first thinking",
    body: "Why the operators who win the next decade are the ones who build platforms, not just products.",
  },
  {
    title: "Assets that operate continuously",
    body: "Designing digital assets — content, code, systems — that keep working after you stop.",
  },
  {
    title: "From consumer to builder",
    body: "A practical framework for making the transition, regardless of where you're starting from.",
  },
  {
    title: "Leverage, and legacy",
    body: "Long-term thinking about wealth that compounds and outlasts any single venture.",
  },
];

export function AboutSection() {
  return (
    <section id="why-early-access" className="border-t border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-gold-300">
            Inside the book
          </span>
          <h2 className="mt-4 font-serif-display text-3xl text-paper sm:text-4xl">
            A strategic guide for builders, not a hype cycle
          </h2>
          <p className="mt-5 text-base leading-relaxed text-paper-dim">{book.description}</p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <div
              key={pillar.title}
              className="glass-panel rounded-xl p-6 transition-colors hover:border-gold-400/30"
            >
              <h3 className="font-serif-display text-lg text-paper">{pillar.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-paper-dim">{pillar.body}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-violet-400/25 bg-violet-900/30 p-8 text-center sm:p-10">
          <h3 className="font-serif-display text-2xl text-paper">
            Why {book.earlyAccessChapter} is releasing early
          </h3>
          <p className="mt-4 text-base leading-relaxed text-paper-dim">
            Before the full book launches, we&apos;re opening {book.earlyAccessChapterTitle} to
            the people helping build momentum for release day. It&apos;s our way of saying thank
            you to the early supporters who follow, engage with, and share the launch — and a
            preview of the strategic depth in the full {book.edition.toLowerCase()}.
          </p>
        </div>
      </div>
    </section>
  );
}
