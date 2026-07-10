import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FlowraMarket Africa — Create it. Sell it. Scale it.",
    template: "%s · FlowraMarket Africa",
  },
  description:
    "FlowraMarket Africa is the AI-powered creator commerce marketplace for Africa — storefronts, digital products, courses, and local payments for African creators and businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
