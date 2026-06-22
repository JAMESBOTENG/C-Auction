import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getListingAccess } from "@/lib/access";
import { getNormalizedFinancials } from "@/lib/listing-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/misc";
import { VerifiedBadge } from "@/components/verified-badge";
import { FinancialSchedule } from "@/components/financial-schedule";
import { UnlockForm } from "@/components/unlock-form";
import { DealRoom } from "@/components/deal-room";
import { ListingImage } from "@/components/listing-image";
import { formatCurrency, formatMultiple, formatNumber } from "@/lib/utils";
import { Lock, FileText, ChevronLeft, Users, CalendarDays, MapPin } from "lucide-react";

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
      <div className="flex items-center gap-2">
        <Link href="/listings" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="size-4" /> All listings
        </Link>
      </div>

      {/* Hero image */}
      <div className="overflow-hidden rounded-2xl shadow-elevated">
        <ListingImage imageUrl={listing.imageUrl} title={listing.title} className="h-64 md:h-80" />
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-medium">{listing.industry}</Badge>
            {listing.isVerified && <VerifiedBadge />}
          </div>
          <h1 className="text-3xl font-bold leading-tight">{listing.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{listing.state}</span>
            <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />Founded {listing.yearFounded}</span>
            <span className="flex items-center gap-1.5"><Users className="size-3.5" />{formatNumber(listing.employees)} employees</span>
          </div>
        </div>
      </div>

      {/* Headline metrics grid */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Asking price" value={formatCurrency(listing.askingPrice)} primary />
        <StatCard label="SDE" value={formatCurrency(fin?.latest?.sde)} primary />
        <StatCard label="EBITDA" value={formatCurrency(fin?.latest?.ebitda)} />
        <StatCard label="Revenue" value={formatCurrency(fin?.latest?.revenue)} />
        <StatCard label="SDE multiple" value={formatMultiple(fin?.sdeMultiple)} />
        <StatCard label="EBITDA multiple" value={formatMultiple(fin?.ebitdaMultiple)} />
      </div>

      {/* Reason for sale */}
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Reason for sale</h2>
        <p className="text-foreground leading-relaxed">{listing.reasonForSale}</p>
      </div>

      {/* Gated section */}
      {access.unlocked ? (
        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader><CardTitle>Normalized financials & add-back schedule</CardTitle></CardHeader>
            <CardContent>{fin && <FinancialSchedule fin={fin} showWarnings={isAdminView} />}</CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle>Data room</CardTitle></CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
              ) : (
                <ul className="divide-y">
                  {documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-3 text-sm">
                      <span className="flex items-center gap-2"><FileText className="size-4 text-muted-foreground" />{d.filename}<Badge variant="outline">{d.kind}</Badge></span>
                      <a href={d.path} target="_blank" className="font-medium text-primary hover:underline">Download</a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle>Deal room — private messages with {listing.seller.name}</CardTitle></CardHeader>
            <CardContent><DealRoom listingId={listing.id} messages={messages} /></CardContent>
          </Card>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border-2 border-dashed bg-card">
          <div className="bg-muted/50 px-6 py-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Lock className="size-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Full financials & data room are gated</h2>
              <p className="text-sm text-muted-foreground">Unlock with an NDA and proof of funds</p>
            </div>
          </div>
          <div className="px-6 py-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Unlock the itemized SDE/EBITDA derivation, the full add-back schedule with categories,
              supporting documents, and a private deal room by accepting the NDA and attesting proof of funds.
              An admin reviews and approves access — usually within 24 hours.
            </p>
            {!session?.user ? (
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                Sign in as a buyer to request access →
              </Link>
            ) : session.user.role !== "BUYER" ? (
              <p className="text-sm text-muted-foreground">Only buyer accounts can request access to a deal room.</p>
            ) : access.request?.status === "PENDING" ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800">
                Your request is pending admin review
              </div>
            ) : access.request?.status === "DENIED" ? (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800">
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
  return (
    <div className={`rounded-xl border p-4 shadow-card ${primary ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <div className={`text-[10px] font-semibold uppercase tracking-wide ${primary ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{label}</div>
      <div className="mt-1 text-xl font-bold tabular leading-none">{value}</div>
    </div>
  );
}
