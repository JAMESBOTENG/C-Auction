"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveFile } from "@/lib/storage";
import { ADD_BACK_CATEGORIES } from "@/lib/financials";

const yearSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
  revenue: z.coerce.number().min(0),
  cogs: z.coerce.number().min(0),
  ownerSalary: z.coerce.number().min(0),
  operatingExpenses: z.record(z.string(), z.coerce.number()),
});

const addBackSchema = z.object({
  year: z.coerce.number().int(),
  label: z.string().min(1),
  amount: z.coerce.number(),
  category: z.enum(ADD_BACK_CATEGORIES),
  note: z.string().optional().nullable(),
});

const listingSchema = z.object({
  title: z.string().min(3, "Title is required"),
  industry: z.string().min(2, "Industry is required"),
  state: z.string().min(2, "State is required"),
  yearFounded: z.coerce.number().int().min(1800).max(2100),
  employees: z.coerce.number().int().min(0),
  reasonForSale: z.string().min(3, "Reason for sale is required"),
  askingPrice: z.coerce.number().positive("Asking price must be positive"),
  years: z.array(yearSchema).min(1, "At least one year of financials is required"),
  addBacks: z.array(addBackSchema),
});

export type CreateState = { error?: string } | undefined;

export async function createListing(payload: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { ok: false, error: "Only sellers can create listings." };
  }

  const parsed = listingSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const listing = await prisma.listing.create({
    data: {
      sellerId: session.user.id,
      title: d.title,
      industry: d.industry,
      state: d.state.toUpperCase(),
      yearFounded: d.yearFounded,
      employees: d.employees,
      reasonForSale: d.reasonForSale,
      askingPrice: d.askingPrice,
      status: "DRAFT",
      financials: {
        create: d.years.map((y) => ({
          year: y.year,
          revenue: y.revenue,
          cogs: y.cogs,
          ownerSalary: y.ownerSalary,
          operatingExpenses: JSON.stringify(y.operatingExpenses),
        })),
      },
      addBacks: {
        create: d.addBacks.map((a) => ({
          year: a.year,
          label: a.label,
          amount: a.amount,
          category: a.category,
          note: a.note || null,
        })),
      },
    },
  });

  revalidatePath("/seller");
  return { ok: true, id: listing.id };
}

async function assertOwner(listingId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error("Listing not found");
  if (session.user.role !== "SELLER" || listing.sellerId !== session.user.id) {
    throw new Error("Not your listing");
  }
  return { session, listing };
}

export async function submitForReview(listingId: string) {
  const { listing } = await assertOwner(listingId);
  if (listing.status === "DRAFT" || listing.status === "REJECTED") {
    await prisma.listing.update({
      where: { id: listingId },
      data: { status: "PENDING_REVIEW" },
    });
    console.log(`[email] Listing ${listingId} submitted for review.`);
  }
  revalidatePath("/seller");
  revalidatePath(`/seller/${listingId}`);
}

export async function uploadDocument(formData: FormData) {
  const { session } = await assertOwner(formData.get("listingId") as string);
  const file = formData.get("file") as File | null;
  const kind = (formData.get("kind") as string) || "OTHER";
  const listingId = formData.get("listingId") as string;
  if (!file || file.size === 0) return;

  const stored = await saveFile(file);
  await prisma.document.create({
    data: {
      listingId,
      filename: stored.filename,
      path: stored.path,
      kind,
      uploadedBy: session.user.id,
    },
  });
  revalidatePath(`/seller/${listingId}`);
}
