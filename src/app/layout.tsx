import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Chronos — Verified-Financials Business Marketplace",
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex h-full flex-col">
        <div className="aurora" aria-hidden />
        <SiteNav />
        <main className="container flex-1 py-8 md:py-12">{children}</main>

        <footer className="mt-10 border-t border-border/70 bg-card/60 backdrop-blur-sm">
          <div className="container grid gap-8 py-12 md:grid-cols-[1.5fr_1fr_1fr]">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-violet to-brand-fuchsia text-white shadow-glow">
                  <ShieldCheck className="size-4" />
                </div>
                <span className="font-display text-lg font-extrabold tracking-tight">Chronos</span>
              </div>
              <p className="max-w-sm text-sm text-muted-foreground">
                The verified-financials marketplace for acquiring great small businesses from retiring
                owner-operators. Every number, itemized and human-verified.
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-foreground">Marketplace</p>
              <Link href="/listings" className="block text-muted-foreground hover:text-primary">Browse deals</Link>
              <Link href="/login" className="block text-muted-foreground hover:text-primary">Sign in</Link>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-foreground">Trust</p>
              <span className="block text-muted-foreground">Human-verified financials</span>
              <span className="block text-muted-foreground">NDA-gated data rooms</span>
            </div>
          </div>
          <div className="border-t border-border/70">
            <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
              <span>© {new Date().getFullYear()} Chronos · MVP demo</span>
              <span>Verified-financials marketplace for the silver-tsunami transition</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
