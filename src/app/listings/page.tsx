import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getNormalizedFinancials } from "@/lib/listing-data";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/verified-badge";
import { ListingImage } from "@/components/listing-image";
import { formatCurrency, formatMultiple } from "@/lib/utils";
import { SlidersHorizontal, Search } from "lucide-react";

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

  const industries = [...new Set(enriched.map((e) => e.listing.industry))].sort();
  const states = [...new Set(enriched.map((e) => e.listing.state))].sort();
  const hasFilters = Object.values(sp).some(Boolean);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Verified businesses for sale</h1>
        <p className="mt-1 text-muted-foreground">
          Teaser metrics shown. Accept an NDA and attest proof of funds to unlock full financials.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="size-4" /> Filters
        </div>
        <form className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <div className="space-y-1.5">
            <Label className="text-xs">Industry</Label>
            <Select name="industry" defaultValue={sp.industry ?? ""}>
              <option value="">All</option>
              {industries.map((i) => <option key={i} value={i}>{i}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">State</Label>
            <Select name="state" defaultValue={sp.state ?? ""}>
              <option value="">All</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Min revenue</Label>
            <Input name="minRevenue" type="number" placeholder="0" defaultValue={sp.minRevenue ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max revenue</Label>
            <Input name="maxRevenue" type="number" defaultValue={sp.maxRevenue ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Min SDE</Label>
            <Input name="minSde" type="number" defaultValue={sp.minSde ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max SDE</Label>
            <Input name="maxSde" type="number" defaultValue={sp.maxSde ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max price</Label>
            <Input name="maxPrice" type="number" defaultValue={sp.maxPrice ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max multiple</Label>
            <Input name="maxMultiple" type="number" step="0.1" defaultValue={sp.maxMultiple ?? ""} />
          </div>
          <div className="col-span-2 flex items-end gap-2 sm:col-span-4 lg:col-span-8">
            <Button type="submit" size="sm" className="gap-1.5"><Search className="size-3.5" />Apply</Button>
            {hasFilters && (
              <Link href="/listings"><Button type="button" variant="ghost" size="sm">Clear</Button></Link>
            )}
          </div>
        </form>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{filtered.length}</span> verified listing{filtered.length !== 1 ? "s" : ""}
          {hasFilters && " matching filters"}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(({ listing, fin }) => (
          <Link key={listing.id} href={`/listings/${listing.id}`} className="group">
            <article className="overflow-hidden rounded-xl border bg-card shadow-card card-hover h-full flex flex-col">
              <ListingImage imageUrl={listing.imageUrl} title={listing.title} className="h-48" />
              <div className="flex flex-1 flex-col p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{listing.industry} · {listing.state} · Est. {listing.yearFounded}</p>
                    <h3 className="mt-0.5 font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">{listing.title}</h3>
                  </div>
                  <VerifiedBadge className="shrink-0" />
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 mt-auto">
                  <Metric label="Asking price" value={formatCurrency(listing.askingPrice)} highlight />
                  <Metric label="SDE (latest yr)" value={formatCurrency(fin?.latest?.sde)} highlight />
                  <Metric label="Revenue" value={formatCurrency(fin?.latest?.revenue)} />
                  <Metric label="SDE multiple" value={formatMultiple(fin?.sdeMultiple)} />
                </div>

                <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>{listing.employees} employees</span>
                  <span className="font-medium text-primary group-hover:underline">View deal →</span>
                </div>
              </div>
            </article>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed py-20 text-center text-muted-foreground">
          No listings match your filters. <Link href="/listings" className="text-primary hover:underline">Clear filters</Link>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="metric-label">{label}</div>
      <div className={highlight ? "metric-value" : "text-sm font-semibold tabular"}>{value}</div>
    </div>
  );
}
