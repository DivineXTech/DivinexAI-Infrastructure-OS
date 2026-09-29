import type { ReactNode } from "react";

export function LegalPageShell({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="font-serif-display text-3xl text-paper sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-paper-dim/60">Last updated: {updatedAt}</p>
      <div className="gold-divider my-8" />
      <div className="prose-legal flex flex-col gap-6 text-sm leading-relaxed text-paper-dim [&_h2]:mt-6 [&_h2]:font-serif-display [&_h2]:text-xl [&_h2]:text-paper [&_a]:text-gold-300 [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-paper [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2">
        {children}
      </div>
    </div>
  );
}
