import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getNormalizedFinancials } from "@/lib/listing-data";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label, Select, Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/verified-badge";
import { formatCurrency, formatMultiple } from "@/lib/utils";

type SearchParams = { [k: string]: string | undefined };

function num(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  // Only VERIFIED (and PENDING for transparency? spec: browse verified) — show VERIFIED.
  const listings = await prisma.listing.findMany({
    where: {
      status: "VERIFIED",
      ...(sp.industry ? { industry: sp.industry } : {}),
      ...(sp.state ? { state: sp.state } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  // Normalize each and apply numeric range filters (computed metrics).
  const enriched = await Promise.all(
    listings.map(async (l) => ({ listing: l, fin: await getNormalizedFinancials(l.id) }))
  );

  const minRev = num(sp.minRevenue);
  const maxRev = num(sp.maxRevenue);
  const minSde = num(sp.minSde);
  const maxSde = num(sp.maxSde);
  const minPrice = num(sp.minPrice);
  const maxPrice = num(sp.maxPrice);
  const maxMult = num(sp.maxMultiple);

  const filtered = enriched.filter(({ listing, fin }) => {
    const rev = fin?.latest?.revenue ?? 0;
    const sde = fin?.latest?.sde ?? 0;
    const mult = fin?.sdeMultiple ?? Infinity;
    if (minRev !== undefined && rev < minRev) return false;
    if (maxRev !== undefined && rev > maxRev) return false;
    if (minSde !== undefined && sde < minSde) return false;
    if (maxSde !== undefined && sde > maxSde) return false;
    if (minPrice !== undefined && listing.askingPrice < minPrice) return false;
    if (maxPrice !== undefined && listing.askingPrice > maxPrice) return false;
    if (maxMult !== undefined && mult > maxMult) return false;
    return true;
  });

  const industries = [...new Set(enriched.map((e) => e.listing.industry))].sort();
  const states = [...new Set(enriched.map((e) => e.listing.state))].sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Verified businesses for sale</h1>
        <p className="text-muted-foreground">
          Teaser metrics shown. Unlock full financials and the data room with an NDA + proof of funds.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8" method="get">
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select name="industry" defaultValue={sp.industry ?? ""}>
                <option value="">All</option>
                {industries.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Select name="state" defaultValue={sp.state ?? ""}>
                <option value="">All</option>
                {states.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Min revenue</Label>
              <Input name="minRevenue" type="number" defaultValue={sp.minRevenue ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Max revenue</Label>
              <Input name="maxRevenue" type="number" defaultValue={sp.maxRevenue ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Min SDE</Label>
              <Input name="minSde" type="number" defaultValue={sp.minSde ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Max SDE</Label>
              <Input name="maxSde" type="number" defaultValue={sp.maxSde ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Max price</Label>
              <Input name="maxPrice" type="number" defaultValue={sp.maxPrice ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Max multiple</Label>
              <Input name="maxMultiple" type="number" step="0.1" defaultValue={sp.maxMultiple ?? ""} />
            </div>
            <div className="col-span-2 flex items-end gap-2 md:col-span-4 lg:col-span-8">
              <Button type="submit">Apply filters</Button>
              <Link href="/listings">
                <Button type="button" variant="outline">Reset</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">{filtered.length} verified listing(s)</p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(({ listing, fin }) => (
          <Link key={listing.id} href={`/listings/${listing.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="secondary">{listing.industry}</Badge>
                  <VerifiedBadge />
                </div>
                <div>
                  <h3 className="font-semibold leading-tight">{listing.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {listing.state} · Founded {listing.yearFounded} · {listing.employees} employees
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t pt-4 text-sm tabular">
                  <Metric label="Asking price" value={formatCurrency(listing.askingPrice)} />
                  <Metric label="Revenue (latest)" value={formatCurrency(fin?.latest?.revenue)} />
                  <Metric label="SDE (latest)" value={formatCurrency(fin?.latest?.sde)} />
                  <Metric label="SDE multiple" value={formatMultiple(fin?.sdeMultiple)} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
