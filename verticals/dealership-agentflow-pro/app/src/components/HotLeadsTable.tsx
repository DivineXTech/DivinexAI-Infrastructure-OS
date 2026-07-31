export default function HotLeadsTable({
  leads,
}: {
  leads: { lead: string; interest: string; score: number }[];
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Who's hot today</h2>
      <table className="mt-3 w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-neutral-400">
            <th className="pb-2 font-medium">Lead</th>
            <th className="pb-2 font-medium">Interest</th>
            <th className="pb-2 text-right font-medium">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {leads.map((row) => (
            <tr key={row.lead}>
              <td className="py-2 font-medium text-neutral-800 dark:text-neutral-200">{row.lead}</td>
              <td className="py-2 text-neutral-500 dark:text-neutral-400">{row.interest}</td>
              <td className="py-2 text-right font-mono text-neutral-700 dark:text-neutral-300">
                {row.score}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
