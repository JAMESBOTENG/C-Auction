import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getNormalizedFinancials } from "@/lib/listing-data";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/verified-badge";
import { ListingImage } from "@/components/listing-image";
import { formatCurrency, formatMultiple } from "@/lib/utils";
import { SlidersHorizontal, Search, Users, MapPin, TrendingUp } from "lucide-react";

type SP = { [k: string]: string | undefined };

function num(v: string | undefined) {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export default async function ListingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  const listings = await prisma.listing.findMany({
    where: {
      status: "VERIFIED",
      ...(sp.industry ? { industry: sp.industry } : {}),
      ...(sp.state ? { state: sp.state } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const enriched = await Promise.all(
    listings.map(async (l) => ({ listing: l, fin: await getNormalizedFinancials(l.id) }))
  );

  const minRev = num(sp.minRevenue), maxRev = num(sp.maxRevenue);
  const minSde = num(sp.minSde), maxSde = num(sp.maxSde);
  const maxPrice = num(sp.maxPrice), maxMult = num(sp.maxMultiple);

  const filtered = enriched.filter(({ listing, fin }) => {
    const rev = fin?.latest?.revenue ?? 0;
    const sde = fin?.latest?.sde ?? 0;
    const mult = fin?.sdeMultiple ?? Infinity;
    if (minRev !== undefined && rev < minRev) return false;
    if (maxRev !== undefined && rev > maxRev) return false;
    if (minSde !== undefined && sde < minSde) return false;
    if (maxSde !== undefined && sde > maxSde) return false;
    if (maxPrice !== undefined && listing.askingPrice > maxPrice) return false;
    if (maxMult !== undefined && mult > maxMult) return false;
    return true;
  });

  // Industries/states across all verified listings (not just current filter).
  const allVerified = await prisma.listing.findMany({ where: { status: "VERIFIED" }, select: { industry: true, state: true } });
  const industries = [...new Set(allVerified.map((e) => e.industry))].sort();
  const states = [...new Set(allVerified.map((e) => e.state))].sort();
  const hasFilters = Object.values(sp).some(Boolean);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          Verified businesses <span className="text-gradient">for sale</span>
        </h1>
        <p className="text-muted-foreground">
          Teaser metrics shown. Accept an NDA and attest proof of funds to unlock full financials.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* ---------- Filter rail ---------- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <form className="space-y-5 rounded-2xl border border-border/70 bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 font-display text-sm font-bold">
              <SlidersHorizontal className="size-4 text-primary" /> Filter deals
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Industry</Label>
              <Select name="industry" defaultValue={sp.industry ?? ""}>
                <option value="">All industries</option>
                {industries.map((i) => <option key={i} value={i}>{i}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">State</Label>
              <Select name="state" defaultValue={sp.state ?? ""}>
                <option value="">All states</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>

            <FieldPair label="Revenue ($)">
              <Input name="minRevenue" type="number" placeholder="Min" defaultValue={sp.minRevenue ?? ""} />
              <Input name="maxRevenue" type="number" placeholder="Max" defaultValue={sp.maxRevenue ?? ""} />
            </FieldPair>
            <FieldPair label="SDE ($)">
              <Input name="minSde" type="number" placeholder="Min" defaultValue={sp.minSde ?? ""} />
              <Input name="maxSde" type="number" placeholder="Max" defaultValue={sp.maxSde ?? ""} />
            </FieldPair>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Max price</Label>
                <Input name="maxPrice" type="number" placeholder="Any" defaultValue={sp.maxPrice ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max multiple</Label>
                <Input name="maxMultiple" type="number" step="0.1" placeholder="Any" defaultValue={sp.maxMultiple ?? ""} />
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button type="submit" className="w-full gap-1.5"><Search className="size-4" /> Apply filters</Button>
              {hasFilters && (
                <Link href="/listings"><Button type="button" variant="ghost" size="sm" className="w-full">Clear all</Button></Link>
              )}
            </div>
          </form>
        </aside>

        {/* ---------- Results ---------- */}
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{filtered.length}</span> verified listing{filtered.length !== 1 ? "s" : ""}
            {hasFilters && " matching your filters"}
          </p>

          <div className="grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">
            {filtered.map(({ listing, fin }) => (
              <Link key={listing.id} href={`/listings/${listing.id}`} className="group">
                <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card card-hover">
                  <div className="relative">
                    <ListingImage imageUrl={listing.imageUrl} title={listing.title} industry={listing.industry} className="h-48" />
                    <div className="absolute right-3 top-3">
                      <VerifiedBadge />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div>
                      <p className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="size-3" />{listing.state}</span>
                        <span>Est. {listing.yearFounded}</span>
                        <span className="flex items-center gap-1"><Users className="size-3" />{listing.employees}</span>
                      </p>
                      <h3 className="mt-1 font-display text-lg font-bold leading-snug transition-colors line-clamp-2 group-hover:text-primary">{listing.title}</h3>
                    </div>

                    <div className="mt-auto grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70">
                      <Metric label="Asking price" value={formatCurrency(listing.askingPrice)} accent />
                      <Metric label="SDE (latest)" value={formatCurrency(fin?.latest?.sde)} accent />
                      <Metric label="Revenue" value={formatCurrency(fin?.latest?.revenue)} />
                      <Metric label="SDE multiple" value={formatMultiple(fin?.sdeMultiple)} />
                    </div>

                    <span className="flex items-center justify-between text-xs font-semibold text-primary">
                      <span className="flex items-center gap-1 text-muted-foreground"><TrendingUp className="size-3.5 text-success" /> {listing.industry}</span>
                      <span className="group-hover:underline">View deal →</span>
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border py-20 text-center text-muted-foreground">
              No listings match your filters. <Link href="/listings" className="font-semibold text-primary hover:underline">Clear filters</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldPair({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-card p-3">
      <div className="metric-label">{label}</div>
      <div className={accent ? "mt-0.5 text-base font-extrabold tabular text-foreground" : "mt-0.5 text-sm font-semibold tabular"}>{value}</div>
    </div>
  );
}
