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
import { formatCurrency, formatMultiple, formatNumber } from "@/lib/utils";
import { Lock, FileText } from "lucide-react";

export default async function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { seller: true },
  });
  if (!listing) notFound();

  const fin = await getNormalizedFinancials(listing.id);
  const access = await getListingAccess(listing.id, listing.sellerId, session);
  const isAdminView = access.reason === "admin";

  const documents = access.unlocked
    ? await prisma.document.findMany({ where: { listingId: listing.id }, orderBy: { createdAt: "desc" } })
    : [];

  const rawMessages = access.unlocked
    ? await prisma.message.findMany({
        where: { listingId: listing.id },
        include: { fromUser: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const messages = rawMessages.map((m) => ({
    id: m.id,
    body: m.body,
    authorName: m.fromUser.name,
    isMe: m.fromUserId === session?.user?.id,
    createdAt: m.createdAt.toLocaleString(),
  }));

  return (
    <div className="space-y-6">
      <Link href="/listings" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to listings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">{listing.industry}</Badge>
            {listing.isVerified && <VerifiedBadge />}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{listing.title}</h1>
          <p className="text-muted-foreground">
            {listing.state} · Founded {listing.yearFounded} · {formatNumber(listing.employees)} employees
          </p>
        </div>
      </div>

      {/* Headline / teaser metrics — always visible */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Asking price" value={formatCurrency(listing.askingPrice)} />
        <Stat label="Revenue (latest)" value={formatCurrency(fin?.latest?.revenue)} />
        <Stat label="SDE (latest)" value={formatCurrency(fin?.latest?.sde)} />
        <Stat label="EBITDA (latest)" value={formatCurrency(fin?.latest?.ebitda)} />
        <Stat label="SDE multiple" value={formatMultiple(fin?.sdeMultiple)} />
        <Stat label="EBITDA multiple" value={formatMultiple(fin?.ebitdaMultiple)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reason for sale</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">{listing.reasonForSale}</CardContent>
      </Card>

      {/* Gated section */}
      {access.unlocked ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Normalized financials & add-back schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {fin && <FinancialSchedule fin={fin} showWarnings={isAdminView} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data room</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
              ) : (
                <ul className="divide-y">
                  {documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <FileText className="size-4 text-muted-foreground" />
                        {d.filename}
                        <Badge variant="outline">{d.kind}</Badge>
                      </span>
                      <a href={d.path} target="_blank" className="text-primary hover:underline">
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deal room — messages with {listing.seller.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <DealRoom listingId={listing.id} messages={messages} />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-5" /> Full financials & data room are gated
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Unlock the itemized SDE/EBITDA derivation, the full add-back schedule, supporting documents,
              and a private deal room by accepting the NDA and attesting proof of funds.
            </p>
            {!session?.user ? (
              <Link href="/login" className="text-primary hover:underline">
                Sign in as a buyer to request access →
              </Link>
            ) : session.user.role !== "BUYER" ? (
              <p className="text-sm text-muted-foreground">
                Only buyer accounts can request access to a deal room.
              </p>
            ) : access.request?.status === "PENDING" ? (
              <Badge variant="warning">Request pending admin approval</Badge>
            ) : access.request?.status === "DENIED" ? (
              <div className="space-y-3">
                <Badge variant="destructive">Previous request denied</Badge>
                <UnlockForm listingId={listing.id} />
              </div>
            ) : (
              <UnlockForm listingId={listing.id} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular">{value}</div>
      </CardContent>
    </Card>
  );
}
