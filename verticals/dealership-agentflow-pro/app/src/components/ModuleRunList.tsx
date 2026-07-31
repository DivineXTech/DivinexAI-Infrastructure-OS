import type { ModuleRun } from "../data/sampleData";

const statusStyle: Record<ModuleRun["status"], string> = {
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  running: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  queued: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  error: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

export default function ModuleRunList({ runs }: { runs: ModuleRun[] }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
        Command Center — this morning's run
      </h2>
      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
        Sales Floor Director fires every module in order and drops one report on the GM's desk
      </p>
      <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
        {runs.map((run) => (
          <li key={run.code} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="w-8 shrink-0 font-mono text-xs text-neutral-400">{run.code}</span>
            <span className="w-40 shrink-0 font-medium text-neutral-800 dark:text-neutral-200">
              {run.name}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyle[run.status]}`}
            >
              {run.status}
            </span>
            <span className="truncate text-neutral-500 dark:text-neutral-400">{run.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
