const actionStyle: Record<string, string> = {
  Wholesale: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  Reprice: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "Buy more at auction": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

export default function AgingRepriceTable({
  rows,
}: {
  rows: { unit: string; situation: string; action: string }[];
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Aging &amp; reprice</h2>
      <table className="mt-3 w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-neutral-400">
            <th className="pb-2 font-medium">Unit</th>
            <th className="pb-2 font-medium">Situation</th>
            <th className="pb-2 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {rows.map((row) => (
            <tr key={row.unit}>
              <td className="py-2 font-medium text-neutral-800 dark:text-neutral-200">{row.unit}</td>
              <td className="py-2 text-neutral-500 dark:text-neutral-400">{row.situation}</td>
              <td className="py-2 text-right">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionStyle[row.action] ?? ""}`}>
                  {row.action}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
