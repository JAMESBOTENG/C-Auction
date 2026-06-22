import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNormalizedFinancials } from "@/lib/listing-data";
import { submitForReview, uploadDocument } from "@/app/seller/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select, Badge } from "@/components/ui/misc";
import { StatusBadge } from "@/components/status-badge";
import { FinancialSchedule } from "@/components/financial-schedule";
import { formatCurrency } from "@/lib/utils";
import { FileText } from "lucide-react";

export default async function SellerListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { documents: { orderBy: { createdAt: "desc" } } },
  });
  if (!listing) notFound();
  if (session.user.role !== "SELLER" || listing.sellerId !== session.user.id) redirect("/seller");

  const fin = await getNormalizedFinancials(listing.id);

  return (
    <div className="space-y-6">
      <Link href="/seller" className="text-sm text-muted-foreground hover:text-foreground">← My listings</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{listing.title}</h1>
            <StatusBadge status={listing.status} />
          </div>
          <p className="text-muted-foreground">
            {listing.industry} · {listing.state} · {formatCurrency(listing.askingPrice)}
          </p>
        </div>
        {(listing.status === "DRAFT" || listing.status === "REJECTED") && (
          <form action={async () => { "use server"; await submitForReview(listing.id); }}>
            <Button type="submit">Submit for verification</Button>
          </form>
        )}
      </div>

      {listing.status === "REJECTED" && listing.reviewNotes && (
        <Card className="border-destructive/40">
          <CardHeader><CardTitle className="text-destructive">Rejected — reviewer notes</CardTitle></CardHeader>
          <CardContent className="text-sm">{listing.reviewNotes}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Normalized financials (preview)</CardTitle></CardHeader>
        <CardContent>{fin && <FinancialSchedule fin={fin} showWarnings />}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Supporting documents</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload tax returns and P&amp;Ls so an admin can verify your add-back schedule.
          </p>
          {listing.documents.length > 0 && (
            <ul className="divide-y">
              {listing.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" /> {d.filename}
                    <Badge variant="outline">{d.kind}</Badge>
                  </span>
                  <a href={d.path} target="_blank" className="text-primary hover:underline">View</a>
                </li>
              ))}
            </ul>
          )}
          <form action={uploadDocument} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="listingId" value={listing.id} />
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select name="kind" defaultValue="TAX_RETURN">
                <option value="TAX_RETURN">Tax return</option>
                <option value="PNL">P&L statement</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>File</Label>
              <Input type="file" name="file" required />
            </div>
            <Button type="submit">Upload</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
