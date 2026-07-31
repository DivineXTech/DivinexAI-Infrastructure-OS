interface HeaderProps {
  dealershipName: string;
}

export default function Header({ dealershipName }: HeaderProps) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="flex flex-col gap-1 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-brand)]">
          <span aria-hidden>☀️</span>
          AgentFlow Pro · powered by DivinexAI
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50 sm:text-3xl">
          {dealershipName} — GM's Daily Report
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Sales Floor Director · orchestrator run for {today}
        </p>
      </div>
      <button
        type="button"
        className="w-fit rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
      >
        Re-run orchestrator
      </button>
    </header>
  );
}
