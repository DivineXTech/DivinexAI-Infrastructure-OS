/**
 * Chapter 12 early-access content. Centralized here so the gated preview
 * can be replaced with the final manuscript excerpt without touching the
 * page/route logic in src/app/chapter-12/page.tsx.
 */
export const chapter12 = {
  number: 12,
  title: "The Infrastructure Advantage",
  readingTime: "9 min read",
  sections: [
    {
      heading: "The shift from product to platform",
      paragraphs: [
        "Every generation of builders inherits a different set of tools, and every generation makes the same mistake early on: they build a product when they should be building infrastructure. A product solves one problem, once, for one customer at a time. Infrastructure solves the problem for everyone who comes after — automatically, repeatedly, without you in the room.",
        "The operators who compound wealth fastest in this decade are not the ones with the most clever idea. They're the ones who noticed that AI collapsed the cost of building infrastructure to something close to zero, and who moved early to own a layer of it — a workflow, a dataset, a distribution channel, a system other people now depend on.",
      ],
    },
    {
      heading: "Why ownership beats output",
      paragraphs: [
        "Trading hours for dollars has a hard ceiling: your calendar. Owning a system that produces value while you sleep has no ceiling at all — its limit is how well the system is designed, not how many hours you can personally work.",
        "This is not a call to quit your job or take reckless risk. It's a reframe: every skill you build, every process you automate, every audience you earn should be evaluated by one question — does this make me more dependent on my own continued effort, or less? Infrastructure-first thinking always chooses less.",
      ],
    },
    {
      heading: "What AI actually changed",
      paragraphs: [
        "AI didn't invent leverage — capital, code, and media have always been leverage. What changed is who can access it. A single builder with the right systems can now do the work that used to require a team: research, drafting, customer support, even parts of engineering.",
        "The advantage doesn't go to whoever uses AI the most. It goes to whoever designs the system AI operates inside of. That system — the infrastructure — is the actual asset. The AI is just the labor running through it.",
      ],
    },
    {
      heading: "Building your first piece of infrastructure",
      paragraphs: [
        "You don't need a company, funding, or a team to start. You need one repeatable process, currently done manually, that you're willing to systemize until it runs without your constant attention. Pick the one that already produces value for someone today — a service, a piece of content, a tool you built for yourself — and ask what it would take for that value to be delivered automatically, at scale, tomorrow.",
        "That's the exercise the rest of this book walks through, chapter by chapter: identifying leverage points, systemizing them with the tools now available, and compounding ownership instead of output.",
      ],
    },
  ],
} as const;
