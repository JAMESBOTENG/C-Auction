import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "Succession — Verified-Financials Marketplace",
  description:
    "Buy and sell owner-operated US businesses with standardized, verified financials. Defensible SDE & EBITDA with auditable add-back schedules.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteNav />
        <main className="container py-8">{children}</main>
        <footer className="border-t py-6 text-center text-sm text-muted-foreground">
          Succession · Verified financials for the silver-tsunami transition · MVP demo
        </footer>
      </body>
    </html>
  );
}
