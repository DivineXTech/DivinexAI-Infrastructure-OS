export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border bg-surface-muted">
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        {eyebrow ? (
          <p className="mb-2 text-sm font-medium uppercase tracking-wide text-accent">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-4xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? (
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">{description}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
