import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "Succession — Verified-Financials Business Marketplace",
  description:
    "Acquisition marketplace for retiring owner-operators. Every listing's financials are normalized into a defensible SDE & EBITDA with an itemized, auditable add-back schedule.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex h-full flex-col">
        <SiteNav />
        <main className="flex-1 container py-8 md:py-10">{children}</main>
        <footer className="border-t bg-card py-6">
          <div className="container flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
            <span className="font-semibold text-foreground">Succession</span>
            <span>Verified-financials marketplace for the silver-tsunami transition · MVP demo</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
