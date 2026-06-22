import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/misc";
import { formatCurrency } from "@/lib/utils";

const statusBadge = {
  PENDING: { variant: "warning" as const, label: "Pending review" },
  APPROVED: { variant: "success" as const, label: "Unlocked" },
  DENIED: { variant: "destructive" as const, label: "Denied" },
};

export default async function BuyerDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "BUYER") redirect("/listings");

  const requests = await prisma.unlockRequest.findMany({
    where: { buyerId: session.user.id },
    include: { listing: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My deals</h1>
        <p className="text-muted-foreground">Listings where you&apos;ve requested or unlocked access.</p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No access requests yet. <Link href="/listings" className="text-primary hover:underline">Browse listings →</Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const s = statusBadge[r.status];
            return (
              <Link key={r.id} href={`/listings/${r.listingId}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{r.listing.title}</h3>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {r.listing.industry} · {r.listing.state} · {formatCurrency(r.listing.askingPrice)}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {r.status === "APPROVED" ? "Open deal room →" : "View →"}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
