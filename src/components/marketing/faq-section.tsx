import { book } from "@/config/site";

const faqs = [
  {
    q: "Is joining the waitlist free?",
    a: "Yes. Joining the waitlist and reading the early-access chapter is completely free — no purchase necessary.",
  },
  {
    q: `What is ${book.earlyAccessChapter}?`,
    a: `${book.earlyAccessChapterTitle} is a full chapter from ${book.title}, unlocked early for supporters who complete the launch actions and join the waitlist.`,
  },
  {
    q: "How does the referral program work?",
    a: "Every subscriber gets a unique referral link. Friends who join through your link count toward your referral total, which factors into launch-day rewards.",
  },
  {
    q: "Are the social actions verified?",
    a: "Social actions are self-confirmed by you. We don't currently perform platform-side verification unless a connected platform explicitly supports it.",
  },
  {
    q: "When does the full book launch?",
    a: "Waitlist members receive the official launch date and purchase link by email before anyone else.",
  },
];

export function FaqSection() {
  return (
    <section className="border-t border-hairline">
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <h2 className="text-center font-serif-display text-3xl text-paper sm:text-4xl">
          Frequently asked questions
        </h2>
        <dl className="mt-10 flex flex-col gap-6">
          {faqs.map((item) => (
            <div key={item.q} className="border-b border-hairline pb-6">
              <dt className="font-serif-display text-lg text-paper">{item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-paper-dim">{item.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
