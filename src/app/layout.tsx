import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { book, siteUrl, assets } from "@/config/site";
import "./globals.css";

const editorial = Playfair_Display({
  variable: "--font-editorial",
  subsets: ["latin"],
  display: "swap",
});

const interfaceFont = Inter({
  variable: "--font-interface",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${book.title} — Early Access Waitlist`,
    template: `%s — ${book.title}`,
  },
  description: book.description,
  openGraph: {
    title: `${book.title} — Early Access Waitlist`,
    description: book.description,
    url: siteUrl,
    siteName: book.title,
    images: [{ url: assets.ogImage, width: assets.coverWidth, height: assets.coverHeight }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${book.title} — Early Access Waitlist`,
    description: book.description,
    images: [assets.ogImage],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${editorial.variable} ${interfaceFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
