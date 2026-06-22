import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/misc";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";

export default async function SellerDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SELLER") redirect("/listings");

  const listings = await prisma.listing.findMany({
    where: { sellerId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My listings</h1>
          <p className="text-muted-foreground">Create and manage your business listings.</p>
        </div>
        <Link href="/seller/new">
          <Button>List a business</Button>
        </Link>
      </div>

      {listings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            You haven&apos;t created any listings yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {listings.map((l) => (
            <Link key={l.id} href={`/seller/${l.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{l.title}</h3>
                      <StatusBadge status={l.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {l.industry} · {l.state} · {formatCurrency(l.askingPrice)}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">Manage →</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
