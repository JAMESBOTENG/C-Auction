import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getListingAccess } from "@/lib/access";
import { getNormalizedFinancials } from "@/lib/listing-data";
import { buildWorkbook } from "@/lib/statements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/misc";
import { VerifiedBadge } from "@/components/verified-badge";
import { FinancialSchedule } from "@/components/financial-schedule";
import { FinancialStatements } from "@/components/financial-statements";
import { TrendChart } from "@/components/trend-chart";
import { UnlockForm } from "@/components/unlock-form";
import { DealRoom } from "@/components/deal-room";
import { ListingImage } from "@/components/listing-image";
import { formatCurrency, formatMultiple, formatNumber } from "@/lib/utils";
import { Lock, FileText, ChevronLeft, Users, CalendarDays, MapPin, MessageSquare, TrendingUp } from "lucide-react";

export default async function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const listing = await prisma.listing.findUnique({ where: { id }, include: { seller: true } });
  if (!listing) notFound();

  const fin = await getNormalizedFinancials(listing.id);
  const access = await getListingAccess(listing.id, listing.sellerId, session);
  const isAdminView = access.reason === "admin";

  const documents = access.unlocked
    ? await prisma.document.findMany({ where: { listingId: listing.id }, orderBy: { createdAt: "desc" } })
    : [];

  const rawMessages = access.unlocked
    ? await prisma.message.findMany({ where: { listingId: listing.id }, include: { fromUser: true }, orderBy: { createdAt: "asc" } })
    : [];
  const messages = rawMessages.map((m) => ({
    id: m.id, body: m.body, authorName: m.fromUser.name,
    isMe: m.fromUserId === session?.user?.id, createdAt: m.createdAt.toLocaleString(),
  }));

  return (
    <div className="space-y-8">
      <Link href="/listings" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
        <ChevronLeft className="size-4" /> All listings
      </Link>

      {/* Hero */}
      <div className="overflow-hidden rounded-3xl shadow-elevated">
        <ListingImage imageUrl={listing.imageUrl} title={listing.title} industry={listing.industry} className="h-64 md:h-80" />
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-semibold">{listing.industry}</Badge>
          {listing.isVerified && <VerifiedBadge />}
        </div>
        <h1 className="font-display text-3xl font-extrabold leading-tight md:text-4xl">{listing.title}</h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><MapPin className="size-4 text-primary/70" />{listing.state}</span>
          <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-primary/70" />Founded {listing.yearFounded}</span>
          <span className="flex items-center gap-1.5"><Users className="size-4 text-primary/70" />{formatNumber(listing.employees)} employees</span>
        </div>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Asking price" value={formatCurrency(listing.askingPrice)} primary />
        <StatCard label="SDE" value={formatCurrency(fin?.latest?.sde)} primary />
        <StatCard label="EBITDA" value={formatCurrency(fin?.latest?.ebitda)} />
        <StatCard label="Revenue" value={formatCurrency(fin?.latest?.revenue)} />
        <StatCard label="SDE multiple" value={formatMultiple(fin?.sdeMultiple)} />
        <StatCard label="EBITDA multiple" value={formatMultiple(fin?.ebitdaMultiple)} />
      </div>

      {/* Performance trend (teaser) + reason for sale */}
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        {fin && fin.years.length > 0 && (
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-card">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="size-4 text-accent" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {fin.years.length}-year performance
              </h2>
            </div>
            <TrendChart
              data={fin.years.map((y) => ({ label: String(y.year), revenue: y.revenue, sde: y.sde }))}
            />
          </div>
        )}
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-card">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">Reason for sale</h2>
          <p className="leading-relaxed text-foreground">{listing.reasonForSale}</p>
        </div>
      </div>

      {/* Gated section */}
      {access.unlocked ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial statements</CardTitle>
              <p className="text-sm text-muted-foreground">
                Income statement, balance sheet, cash flow and forecast — switch sheets like a workbook.
              </p>
            </CardHeader>
            <CardContent>{fin && <FinancialStatements workbook={buildWorkbook(fin)} />}</CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>SDE / EBITDA normalization &amp; add-back schedule</CardTitle></CardHeader>
            <CardContent>{fin && <FinancialSchedule fin={fin} showWarnings={isAdminView} />}</CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Data room</CardTitle></CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
              ) : (
                <ul className="divide-y divide-border/70">
                  {documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-3 text-sm">
                      <span className="flex items-center gap-2"><FileText className="size-4 text-muted-foreground" />{d.filename}<Badge variant="outline">{d.kind}</Badge></span>
                      <a href={d.path} target="_blank" className="font-semibold text-primary hover:underline">Download</a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageSquare className="size-4 text-primary" /> Deal room — private with {listing.seller.name}</CardTitle>
            </CardHeader>
            <CardContent><DealRoom listingId={listing.id} messages={messages} /></CardContent>
          </Card>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
          <div className="flex items-center gap-3 border-b border-border/70 bg-gradient-to-r from-primary/5 to-accent/5 px-6 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-violet to-brand-fuchsia text-white shadow-glow">
              <Lock className="size-5" />
            </div>
            <div>
              <h2 className="font-display font-bold">Full financials &amp; data room are gated</h2>
              <p className="text-sm text-muted-foreground">Unlock with an NDA and proof of funds</p>
            </div>
          </div>
          <div className="space-y-4 px-6 py-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Unlock the itemized SDE/EBITDA derivation, the full add-back schedule with categories,
              supporting documents, and a private deal room by accepting the NDA and attesting proof of funds.
              An admin reviews and approves access — usually within 24 hours.
            </p>
            {!session?.user ? (
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                Sign in as a buyer to request access →
              </Link>
            ) : session.user.role !== "BUYER" ? (
              <p className="text-sm text-muted-foreground">Only buyer accounts can request access to a deal room.</p>
            ) : access.request?.status === "PENDING" ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800">
                Your request is pending admin review
              </div>
            ) : access.request?.status === "DENIED" ? (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-800">
                  Previous request denied
                </div>
                <UnlockForm listingId={listing.id} />
              </div>
            ) : (
              <UnlockForm listingId={listing.id} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  if (primary) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-brand-violet to-brand-fuchsia p-4 text-white shadow-glow">
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/75">{label}</div>
        <div className="mt-1 text-xl font-extrabold tabular leading-none">{value}</div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-extrabold tabular leading-none">{value}</div>
    </div>
  );
}
