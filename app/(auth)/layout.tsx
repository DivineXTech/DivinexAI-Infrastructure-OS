import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-muted px-6 py-12">
      <Link href="/" className="mb-8 text-lg font-semibold tracking-tight text-ink">
        KushPrintCo <span className="text-accent">OS</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
