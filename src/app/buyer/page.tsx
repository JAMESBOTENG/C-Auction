import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNormalizedFinancials } from "@/lib/listing-data";
import { Badge } from "@/components/ui/misc";
import { ListingImage } from "@/components/listing-image";
import { formatCurrency } from "@/lib/utils";
import { LockOpen, Clock, XCircle, ArrowRight } from "lucide-react";

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
  const fins = await Promise.all(requests.map((r) => getNormalizedFinancials(r.listingId)));

  const unlocked = requests.filter((r) => r.status === "APPROVED").length;
  const pending = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">My deals</h1>
        <p className="mt-1 text-muted-foreground">Listings where you&apos;ve requested or unlocked access.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard icon={LockOpen} label="Unlocked" value={unlocked} grad="from-emerald-500 to-teal-500" />
        <SummaryCard icon={Clock} label="Pending" value={pending} grad="from-amber-500 to-orange-500" />
        <SummaryCard icon={XCircle} label="Total requests" value={requests.length} grad="from-brand-violet to-brand-fuchsia" />
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
          No access requests yet. <Link href="/listings" className="font-semibold text-primary hover:underline">Browse listings →</Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {requests.map((r, i) => {
            const s = statusBadge[r.status];
            return (
              <Link key={r.id} href={`/listings/${r.listingId}`} className="group">
                <article className="flex overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card card-hover">
                  <ListingImage imageUrl={r.listing.imageUrl} title={r.listing.title} industry={r.listing.industry} className="h-auto w-28 shrink-0" compact />
                  <div className="flex flex-1 flex-col justify-between gap-2 p-4">
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display font-bold leading-snug transition-colors group-hover:text-primary line-clamp-2">{r.listing.title}</h3>
                        <Badge variant={s.variant} className="shrink-0">{s.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.listing.industry} · {r.listing.state}</p>
                    </div>
                    <div className="flex items-end justify-between">
                      <div className="flex gap-4 text-sm">
                        <span><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Asking</span><span className="font-bold tabular">{formatCurrency(r.listing.askingPrice)}</span></span>
                        <span><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">SDE</span><span className="font-bold tabular">{formatCurrency(fins[i]?.latest?.sde)}</span></span>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                        {r.status === "APPROVED" ? "Deal room" : "View"} <ArrowRight className="size-3.5" />
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, grad }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; grad: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${grad} text-white`}>
        <Icon className="size-5" />
      </div>
      <div className="font-display text-3xl font-extrabold tabular">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
