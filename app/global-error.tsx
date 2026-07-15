"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div
          role="alert"
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            padding: "1.5rem",
          }}
        >
          <h1>Application error</h1>
          <p>A critical error occurred. Please reload the page.</p>
          {error.digest ? <code>Reference: {error.digest}</code> : null}
          <button onClick={() => reset()}>Try again</button>
        </div>
      </body>
    </html>
  );
}
