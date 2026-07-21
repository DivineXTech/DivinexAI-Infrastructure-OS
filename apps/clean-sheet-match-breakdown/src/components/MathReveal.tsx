import { useState } from "react";

export function MathReveal({ rows }: { rows: { label: string; value: string }[] }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;
  return (
    <div className="math-reveal">
      <button className="math-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide the math" : "Show the math"}
        <span className="chevron">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <table className="math-table mono">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="math-label">{r.label}</td>
                <td className="math-value">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
