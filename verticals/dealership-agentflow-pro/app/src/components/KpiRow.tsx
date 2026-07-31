interface Kpi {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
}

const trendColor: Record<Kpi["trend"], string> = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-rose-600 dark:text-rose-400",
  flat: "text-neutral-500 dark:text-neutral-400",
};

const trendGlyph: Record<Kpi["trend"], string> = {
  up: "▲",
  down: "▼",
  flat: "•",
};

export default function KpiRow({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {kpi.label}
          </div>
          <div className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            {kpi.value}
          </div>
          <div className={`mt-1 text-xs font-medium ${trendColor[kpi.trend]}`}>
            {trendGlyph[kpi.trend]} {kpi.delta}
          </div>
        </div>
      ))}
    </div>
  );
}
