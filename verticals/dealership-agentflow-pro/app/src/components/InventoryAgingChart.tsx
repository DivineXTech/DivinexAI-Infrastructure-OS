import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function InventoryAgingChart({
  data,
}: {
  data: { bucket: string; units: number }[];
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
        Inventory aging
      </h2>
      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">units by days on lot</p>
      <div className="mt-3 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
            <XAxis dataKey="bucket" tick={{ fontSize: 12 }} stroke="currentColor" className="text-neutral-400" />
            <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-neutral-400" allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              cursor={{ fill: "rgba(255,106,61,0.08)" }}
            />
            <Bar dataKey="units" fill="#ff6a3d" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
