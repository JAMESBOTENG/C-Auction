"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getListingAccess } from "@/lib/access";

const unlockSchema = z.object({
  listingId: z.string().min(1),
  nda: z.literal("on", { errorMap: () => ({ message: "You must accept the NDA." }) }),
  proofOfFundsAmount: z.coerce.number().positive("Enter a positive amount."),
  proofOfFundsSource: z.string().min(2, "Describe the source of funds."),
});

export type ActionState = { error?: string; success?: string } | undefined;

export async function requestUnlock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Sign in to request access." };
  if (session.user.role !== "BUYER") return { error: "Only buyers can request access." };

  const parsed = unlockSchema.safeParse({
    listingId: formData.get("listingId"),
    nda: formData.get("nda"),
    proofOfFundsAmount: formData.get("proofOfFundsAmount"),
    proofOfFundsSource: formData.get("proofOfFundsSource"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { listingId, proofOfFundsAmount, proofOfFundsSource } = parsed.data;

  await prisma.unlockRequest.upsert({
    where: { listingId_buyerId: { listingId, buyerId: session.user.id } },
    update: {
      ndaAcceptedAt: new Date(),
      proofOfFundsAmount,
      proofOfFundsSource,
      status: "PENDING",
    },
    create: {
      listingId,
      buyerId: session.user.id,
      ndaAcceptedAt: new Date(),
      proofOfFundsAmount,
      proofOfFundsSource,
      status: "PENDING",
    },
  });

  // Outbound email is out of scope — log to console per spec.
  console.log(`[email] Unlock requested for listing ${listingId} by ${session.user.email}`);

  revalidatePath(`/listings/${listingId}`);
  return { success: "Request submitted. An admin will review your NDA and proof of funds." };
}

const messageSchema = z.object({
  listingId: z.string().min(1),
  body: z.string().min(1, "Message cannot be empty.").max(5000),
});

export async function postMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) return { error: "Sign in to send messages." };

  const parsed = messageSchema.safeParse({
    listingId: formData.get("listingId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
  if (!listing) return { error: "Listing not found." };

  // Only the seller/admin or an approved buyer may post in the deal room.
  const access = await getListingAccess(listing.id, listing.sellerId, session);
  if (!access.unlocked) return { error: "You don't have access to this deal room yet." };

  await prisma.message.create({
    data: {
      listingId: parsed.data.listingId,
      fromUserId: session.user.id,
      body: parsed.data.body,
    },
  });

  revalidatePath(`/listings/${parsed.data.listingId}`);
  return { success: "Sent." };
}
