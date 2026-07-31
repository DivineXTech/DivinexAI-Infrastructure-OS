import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function GrossByMonthChart({
  data,
}: {
  data: { month: string; gross: number }[];
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Gross by month</h2>
      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">trailing 6 months, $ thousands</p>
      <div className="mt-3 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="currentColor" className="text-neutral-400" />
            <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-neutral-400" />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              cursor={{ fill: "rgba(255,106,61,0.08)" }}
              formatter={(value) => [`$${value}K`, "Gross"]}
            />
            <Bar dataKey="gross" fill="#16171d" radius={[4, 4, 0, 0]} className="dark:fill-neutral-200" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
