import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Divine Media TV",
  description: "DMTV: the AI-native creator ownership & commerce network.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
