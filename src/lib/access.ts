import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

/**
 * Determines whether the current user can see gated content (full financials,
 * documents, deal room) for a listing.
 *   - Sellers see their own listings.
 *   - Admins see everything.
 *   - Buyers see it only with an APPROVED unlock request.
 */
export async function getListingAccess(
  listingId: string,
  sellerId: string,
  session: Session | null
) {
  const user = session?.user;
  if (!user) return { unlocked: false, reason: "anon" as const, request: null };

  if (user.role === "ADMIN") return { unlocked: true, reason: "admin" as const, request: null };
  if (user.role === "SELLER" && user.id === sellerId)
    return { unlocked: true, reason: "owner" as const, request: null };

  const request = await prisma.unlockRequest.findUnique({
    where: { listingId_buyerId: { listingId, buyerId: user.id } },
  });

  return {
    unlocked: request?.status === "APPROVED",
    reason: "buyer" as const,
    request,
  };
}
