import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, FileSpreadsheet, Lock, ArrowRight, TrendingUp, Sparkles, BadgeCheck,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getNormalizedFinancials } from "@/lib/listing-data";
import { formatCurrency, formatMultiple } from "@/lib/utils";
import { VerifiedBadge } from "@/components/verified-badge";
import { ListingImage } from "@/components/listing-image";
import { TrendChart } from "@/components/trend-chart";

export default async function Home() {
  const featured = await prisma.listing.findMany({
    where: { status: "VERIFIED" },
    take: 3,
    orderBy: { createdAt: "desc" },
  });
  const featuredFin = await Promise.all(featured.map((l) => getNormalizedFinancials(l.id)));
  const totalVerified = await prisma.listing.count({ where: { status: "VERIFIED" } });

  const heroFin = featuredFin.find((f) => f?.latest);
  const heroListing = heroFin ? featured[featuredFin.indexOf(heroFin)] : null;
  const heroDeal =
    heroFin && heroListing
      ? {
          title: heroListing.title,
          industry: heroListing.industry,
          state: heroListing.state,
          asking: heroListing.askingPrice,
          sde: heroFin.latest!.sde,
          multiple: heroFin.sdeMultiple,
          years: heroFin.years.map((y) => ({ label: String(y.year), revenue: y.revenue, sde: y.sde })),
        }
      : null;

  return (
    <div className="space-y-24">
      {/* ---------- Hero ---------- */}
      <section className="grid items-center gap-12 py-6 animate-fade-up lg:grid-cols-[1.04fr_0.96fr]">
        <div className="space-y-7 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            Human-verified financials on every single listing
          </div>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Buy a business with
            <span className="block text-gradient">financials you can trust.</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0">
            Chronos turns a retiring owner&rsquo;s messy books into a defensible, itemized SDE and EBITDA —
            then a human verifies every figure against source documents. No junk. No guesswork.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <Link href="/listings">
              <Button size="lg" className="gap-2">
                Browse verified deals <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">Sign in</Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-2 text-sm text-muted-foreground lg:justify-start">
            <span className="flex items-center gap-2"><TrendingUp className="size-4 text-accent" /><strong className="text-foreground">{totalVerified}</strong> verified listings</span>
            <span className="flex items-center gap-2"><BadgeCheck className="size-4 text-primary" /><strong className="text-foreground">100%</strong> admin-verified</span>
            <span className="flex items-center gap-2"><FileSpreadsheet className="size-4 text-brand-cyan" /><strong className="text-foreground">3-year</strong> normalized trend</span>
          </div>
        </div>

        {/* Live deal mockup */}
        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-brand-mesh opacity-20 blur-2xl" aria-hidden />
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-elevated sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {heroDeal ? `${heroDeal.industry} · ${heroDeal.state}` : "Residential HVAC · TX"}
                </p>
                <h3 className="font-display text-base font-bold leading-snug">
                  {heroDeal ? heroDeal.title : "Established Residential HVAC Contractor"}
                </h3>
              </div>
              <VerifiedBadge className="shrink-0" />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <MockMetric label="Asking" value={formatCurrency(heroDeal ? heroDeal.asking : 1_950_000)} />
              <MockMetric label="SDE" value={formatCurrency(heroDeal ? heroDeal.sde : 685_000)} accent />
              <MockMetric label="Multiple" value={formatMultiple(heroDeal ? heroDeal.multiple : 2.85)} />
            </div>

            <div className="mt-4 rounded-xl border border-border/60 bg-secondary/40 p-3">
              <TrendChart
                data={
                  heroDeal && heroDeal.years.length
                    ? heroDeal.years
                    : [
                        { label: "2021", revenue: 2_800_000, sde: 560_000 },
                        { label: "2022", revenue: 3_150_000, sde: 620_000 },
                        { label: "2023", revenue: 3_420_000, sde: 685_000 },
                      ]
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Stats band ---------- */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-mesh p-10 text-white shadow-elevated sm:p-14">
        <div className="absolute inset-0 cover-grain opacity-30" />
        <div className="relative grid gap-8 text-center sm:grid-cols-3">
          {[
            { value: "SDE + EBITDA", label: "Both multiples computed on every deal, itemized line-by-line" },
            { value: "Add-back audit", label: "Every owner add-back categorized, flagged and reviewed" },
            { value: "Gated access", label: "Full financials unlock only after NDA + proof of funds" },
          ].map((s) => (
            <div key={s.value} className="space-y-2">
              <div className="font-display text-2xl font-extrabold sm:text-3xl">{s.value}</div>
              <p className="mx-auto max-w-xs text-sm text-white/80">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="space-y-10">
        <div className="text-center">
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">How Chronos works</h2>
          <p className="mt-2 text-muted-foreground">Three things make a listing trustworthy.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: FileSpreadsheet,
              title: "Normalized financials",
              body: "Three years of revenue, COGS, opex, owner comp and add-backs become a transparent SDE and EBITDA — every figure itemized so you see exactly how it was derived.",
              grad: "from-brand-violet to-brand-indigo",
            },
            {
              icon: ShieldCheck,
              title: "Human-verified",
              body: "Owners upload tax returns and P&Ls. Our team reviews the add-back schedule and supporting docs before a listing earns the Financials Verified badge.",
              grad: "from-brand-fuchsia to-brand-pink",
            },
            {
              icon: Lock,
              title: "Gated data rooms",
              body: "Accept an NDA and attest proof of funds to unlock full financials, documents, and a private deal room with the seller.",
              grad: "from-brand-cyan to-brand-teal",
            },
          ].map(({ icon: Icon, title, body, grad }) => (
            <div key={title} className="group rounded-2xl border border-border/70 bg-card p-7 shadow-card card-hover">
              <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${grad} text-white shadow-sm`}>
                <Icon className="size-6" />
              </div>
              <h3 className="mb-2 font-display text-lg font-bold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Featured listings ---------- */}
      {featured.length > 0 && (
        <section className="space-y-7">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-3xl font-extrabold">Featured deals</h2>
              <p className="mt-1 text-muted-foreground">Verified, normalized and ready to diligence.</p>
            </div>
            <Link href="/listings" className="flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2 transition-all">
              View all <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {featured.map((l, i) => {
              const fin = featuredFin[i];
              return (
                <Link key={l.id} href={`/listings/${l.id}`} className="group">
                  <article className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card card-hover">
                    <ListingImage imageUrl={l.imageUrl} title={l.title} industry={l.industry} className="h-44" />
                    <div className="space-y-3 p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">{l.industry} · {l.state}</p>
                          <h3 className="mt-0.5 font-display font-bold leading-snug transition-colors group-hover:text-primary">{l.title}</h3>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
                        <SmallMetric label="Asking" value={formatCurrency(l.askingPrice)} />
                        <SmallMetric label="SDE" value={formatCurrency(fin?.latest?.sde)} />
                        <SmallMetric label="Revenue" value={formatCurrency(fin?.latest?.revenue)} />
                        <SmallMetric label="Multiple" value={formatMultiple(fin?.sdeMultiple)} />
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- CTA ---------- */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-secondary/60 p-10 text-center sm:p-16">
        <div className="mx-auto max-w-2xl space-y-5">
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
            Ready to find your <span className="text-gradient">next acquisition?</span>
          </h2>
          <p className="text-muted-foreground">
            Browse verified listings, or sign in to request access to a deal room.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/listings"><Button size="lg" className="gap-2">Explore listings <ArrowRight className="size-4" /></Button></Link>
            <Link href="/login"><Button size="lg" variant="outline">Create an account</Button></Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-bold tabular">{value}</div>
    </div>
  );
}

function MockMetric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-2.5 ${accent ? "border-accent/20 bg-accent/5" : "border-border/60 bg-secondary/40"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-extrabold tabular ${accent ? "text-accent" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
