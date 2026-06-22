"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

async function assertAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Admin only");
  return session;
}

export async function verifyListing(listingId: string) {
  await assertAdmin();
  await prisma.listing.update({
    where: { id: listingId },
    data: { status: "VERIFIED", isVerified: true, reviewNotes: null },
  });
  console.log(`[email] Listing ${listingId} VERIFIED.`);
  revalidatePath("/admin");
  revalidatePath(`/listings/${listingId}`);
}

const rejectSchema = z.object({
  listingId: z.string().min(1),
  notes: z.string().min(1, "Provide rejection notes."),
});

export async function rejectListing(formData: FormData) {
  await assertAdmin();
  const parsed = rejectSchema.safeParse({
    listingId: formData.get("listingId"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return;
  await prisma.listing.update({
    where: { id: parsed.data.listingId },
    data: { status: "REJECTED", isVerified: false, reviewNotes: parsed.data.notes },
  });
  console.log(`[email] Listing ${parsed.data.listingId} REJECTED.`);
  revalidatePath("/admin");
}

export async function decideUnlock(requestId: string, decision: "APPROVED" | "DENIED") {
  await assertAdmin();
  const req = await prisma.unlockRequest.update({
    where: { id: requestId },
    data: { status: decision },
  });
  console.log(`[email] Unlock request ${requestId} ${decision} for buyer ${req.buyerId}.`);
  revalidatePath("/admin");
  revalidatePath(`/listings/${req.listingId}`);
}
