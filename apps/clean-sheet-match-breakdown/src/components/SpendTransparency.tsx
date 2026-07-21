export function SpendTransparency({
  statement,
  decisive,
}: {
  statement: string;
  decisive: boolean;
}) {
  return (
    <div className={`spend-card ${decisive ? "decisive" : "not-decisive"}`}>
      <span className="eyebrow">Spend Transparency</span>
      <p>{statement}</p>
    </div>
  );
}
