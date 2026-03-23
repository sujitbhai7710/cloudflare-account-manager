import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Cloudflare Account Manager - Multi-Account Dashboard",
  description: "Manage multiple Cloudflare accounts, Workers, D1 databases, KV namespaces, and R2 buckets from one unified dashboard.",
  keywords: ["Cloudflare", "Workers", "D1", "KV", "R2", "Multi-Account", "Dashboard"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-slate-950 text-white`}>
        {children}
      </body>
    </html>
  );
}
