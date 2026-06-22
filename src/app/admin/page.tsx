import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNormalizedFinancials } from "@/lib/listing-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea, Badge, Select } from "@/components/ui/misc";
import { StatusBadge } from "@/components/status-badge";
import { FinancialSchedule } from "@/components/financial-schedule";
import { ListingImage } from "@/components/listing-image";
import { verifyListing, rejectListing, decideUnlock } from "@/app/admin/actions";
import { adminUploadListingImage } from "@/app/admin/listings/actions";
import { formatCurrency } from "@/lib/utils";
import { FileText, Plus } from "lucide-react";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/listings");

  const [queue, allListings, users, unlockRequests] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "PENDING_REVIEW" },
      include: { seller: true, documents: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.listing.findMany({ include: { seller: true }, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.unlockRequest.findMany({
      include: { listing: true, buyer: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const queueFin = await Promise.all(queue.map((l) => getNormalizedFinancials(l.id)));
  const pendingUnlocks = unlockRequests.filter((r) => r.status === "PENDING");

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin dashboard</h1>
          <p className="text-muted-foreground">Verification queue, listings, users and unlock requests.</p>
        </div>
        <Link href="/admin/listings/new">
          <Button className="gap-2"><Plus className="size-4" /> Add listing</Button>
        </Link>
      </div>

      {/* Verification queue */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Verification queue ({queue.length})</h2>
        {queue.length === 0 && <p className="text-sm text-muted-foreground">Nothing awaiting review.</p>}
        {queue.map((l, i) => (
          <Card key={l.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{l.title}</CardTitle>
                <StatusBadge status={l.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {l.industry} · {l.state} · {formatCurrency(l.askingPrice)} · seller {l.seller.name}
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <h4 className="mb-2 text-sm font-medium">Submitted documents ({l.documents.length})</h4>
                {l.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {l.documents.map((d) => (
                      <li key={d.id} className="flex items-center gap-2">
                        <FileText className="size-4 text-muted-foreground" />
                        <a href={d.path} target="_blank" className="text-primary hover:underline">{d.filename}</a>
                        <Badge variant="outline">{d.kind}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {queueFin[i] && <FinancialSchedule fin={queueFin[i]!} showWarnings />}
              <div className="flex flex-wrap items-start gap-3 border-t pt-4">
                <form action={async () => { "use server"; await verifyListing(l.id); }}>
                  <Button variant="success" type="submit">Verify & publish</Button>
                </form>
                <form action={rejectListing} className="flex flex-1 items-end gap-2">
                  <input type="hidden" name="listingId" value={l.id} />
                  <Textarea name="notes" placeholder="Rejection notes (required to reject)" className="min-h-[40px]" />
                  <Button variant="destructive" type="submit">Reject</Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Unlock requests */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Unlock requests — pending ({pendingUnlocks.length})</h2>
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Buyer</th>
                  <th className="py-2 pr-4 font-medium">Listing</th>
                  <th className="py-2 pr-4 font-medium">Proof of funds</th>
                  <th className="py-2 pr-4 font-medium">NDA accepted</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {unlockRequests.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-4">{r.buyer.name}<div className="text-xs text-muted-foreground">{r.buyer.email}</div></td>
                    <td className="py-2 pr-4"><Link href={`/listings/${r.listingId}`} className="text-primary hover:underline">{r.listing.title}</Link></td>
                    <td className="py-2 pr-4">{formatCurrency(r.proofOfFundsAmount)}<div className="text-xs text-muted-foreground">{r.proofOfFundsSource}</div></td>
                    <td className="py-2 pr-4 text-xs">{r.ndaAcceptedAt.toLocaleString()}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={r.status === "APPROVED" ? "success" : r.status === "DENIED" ? "destructive" : "warning"}>{r.status}</Badge>
                    </td>
                    <td className="py-2">
                      {r.status === "PENDING" && (
                        <div className="flex gap-2">
                          <form action={async () => { "use server"; await decideUnlock(r.id, "APPROVED"); }}>
                            <Button size="sm" variant="success" type="submit">Approve</Button>
                          </form>
                          <form action={async () => { "use server"; await decideUnlock(r.id, "DENIED"); }}>
                            <Button size="sm" variant="destructive" type="submit">Deny</Button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {unlockRequests.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">No unlock requests.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* All listings */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">All listings ({allListings.length})</h2>
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Title</th>
                  <th className="py-2 pr-4 font-medium">Industry</th>
                  <th className="py-2 pr-4 font-medium">Seller</th>
                  <th className="py-2 pr-4 font-medium">Price</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {allListings.map((l) => (
                  <tr key={l.id} className="border-b last:border-0 align-middle">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-16 overflow-hidden rounded flex-shrink-0">
                          <ListingImage imageUrl={l.imageUrl} title={l.title} className="h-full" />
                        </div>
                        <div>
                          <Link href={`/listings/${l.id}`} className="text-primary hover:underline font-medium">{l.title}</Link>
                          <form action={adminUploadListingImage} className="mt-1 flex items-center gap-1">
                            <input type="hidden" name="listingId" value={l.id} />
                            <Input type="file" name="file" accept="image/*" className="h-7 text-xs w-36 py-1" />
                            <Button type="submit" size="sm" variant="outline" className="h-7 text-xs px-2">Upload image</Button>
                          </form>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-4">{l.industry}</td>
                    <td className="py-2 pr-4">{l.seller.name}</td>
                    <td className="py-2 pr-4">{formatCurrency(l.askingPrice)}</td>
                    <td className="py-2"><StatusBadge status={l.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* All users */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Users ({users.length})</h2>
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{u.name}</td>
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2"><Badge variant="secondary">{u.role}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
