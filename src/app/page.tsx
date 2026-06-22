import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, FileSpreadsheet, Lock, ArrowRight, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getNormalizedFinancials } from "@/lib/listing-data";
import { formatCurrency, formatMultiple } from "@/lib/utils";
import { VerifiedBadge } from "@/components/verified-badge";
import { ListingImage } from "@/components/listing-image";

export default async function Home() {
  // Fetch a few featured listings for the homepage
  const featured = await prisma.listing.findMany({
    where: { status: "VERIFIED" },
    take: 3,
    orderBy: { createdAt: "desc" },
  });
  const featuredFin = await Promise.all(featured.map((l) => getNormalizedFinancials(l.id)));

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="relative mx-auto max-w-4xl space-y-8 py-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/8 px-4 py-1.5 text-xs font-semibold text-success">
          <ShieldCheck className="size-3.5" />
          Human-verified financials on every listing
        </div>
        <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
          Acquire retiring owners&rsquo;&nbsp;businesses
          <span className="block text-primary/70"> with financials you can trust.</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Every listing&rsquo;s messy owner books are normalized into a defensible SDE and EBITDA — itemized,
          auditable, and verified against supporting documents. No junk. No guesswork.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/listings">
            <Button size="lg" className="gap-2 px-8 text-base shadow-elevated">
              Browse verified deals <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="px-8 text-base">
              Sign in
            </Button>
          </Link>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center justify-center gap-8 pt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><TrendingUp className="size-4 text-success" /><span><strong className="text-foreground">7</strong> verified listings</span></div>
          <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-success" /><span><strong className="text-foreground">100%</strong> admin-verified financials</span></div>
          <div className="flex items-center gap-2"><FileSpreadsheet className="size-4 text-primary/60" /><span><strong className="text-foreground">3-year</strong> normalized trend on every deal</span></div>
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-8">
        <h2 className="text-center text-2xl font-bold">How it works</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: FileSpreadsheet,
              title: "Normalized financials",
              body: "Three years of revenue, COGS, opex, owner comp and add-backs become a transparent SDE and EBITDA — every figure itemized so you see exactly how it was derived.",
            },
            {
              icon: ShieldCheck,
              title: "Human-verified",
              body: "Sellers upload tax returns and P&Ls. Our team reviews the add-back schedule and supporting docs before a listing earns the Financials Verified badge.",
            },
            {
              icon: Lock,
              title: "Gated data rooms",
              body: "Accept an NDA and attest proof of funds to unlock full financials, documents, and a private deal room with the seller.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border bg-card p-6 shadow-card">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8">
                <Icon className="size-5 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured listings */}
      {featured.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-bold">Featured listings</h2>
            <Link href="/listings" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              View all <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {featured.map((l, i) => {
              const fin = featuredFin[i];
              return (
                <Link key={l.id} href={`/listings/${l.id}`} className="group">
                  <div className="overflow-hidden rounded-xl border bg-card shadow-card card-hover">
                    <ListingImage imageUrl={l.imageUrl} title={l.title} className="h-44" />
                    <div className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">{l.industry} · {l.state}</p>
                          <h3 className="mt-0.5 font-semibold leading-snug group-hover:text-primary transition-colors">{l.title}</h3>
                        </div>
                        <VerifiedBadge />
                      </div>
                      <div className="grid grid-cols-2 gap-2 border-t pt-3">
                        <SmallMetric label="Asking" value={formatCurrency(l.askingPrice)} />
                        <SmallMetric label="SDE" value={formatCurrency(fin?.latest?.sde)} />
                        <SmallMetric label="Revenue" value={formatCurrency(fin?.latest?.revenue)} />
                        <SmallMetric label="Multiple" value={formatMultiple(fin?.sdeMultiple)} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-bold tabular">{value}</div>
    </div>
  );
}
