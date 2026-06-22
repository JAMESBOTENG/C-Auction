"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveFile } from "@/lib/storage";
import { ADD_BACK_CATEGORIES } from "@/lib/financials";

async function assertAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Admin only");
  return session;
}

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

const schema = z.object({
  title: z.string().min(3),
  industry: z.string().min(2),
  state: z.string().min(2),
  yearFounded: z.coerce.number().int(),
  employees: z.coerce.number().int().min(0),
  reasonForSale: z.string().min(3),
  askingPrice: z.coerce.number().positive(),
  publishNow: z.boolean().default(false),
  imageUrl: z.string().url().optional().nullable(),
  years: z.array(yearSchema).min(1),
  addBacks: z.array(addBackSchema),
});

export type AdminCreateState = { error?: string } | undefined;

export async function adminCreateListing(
  payload: unknown
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await assertAdmin();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  const listing = await prisma.listing.create({
    data: {
      // Listings created by admin are assigned to a synthetic "platform" seller.
      // We use the admin's own user id — they own the record.
      sellerId: (await auth())!.user.id,
      title: d.title,
      industry: d.industry,
      state: d.state.toUpperCase(),
      yearFounded: d.yearFounded,
      employees: d.employees,
      reasonForSale: d.reasonForSale,
      askingPrice: d.askingPrice,
      status: d.publishNow ? "VERIFIED" : "DRAFT",
      isVerified: d.publishNow,
      imageUrl: d.imageUrl ?? null,
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

  revalidatePath("/admin");
  revalidatePath("/listings");
  return { ok: true, id: listing.id };
}

export async function adminUploadListingImage(formData: FormData) {
  await assertAdmin();
  const listingId = formData.get("listingId") as string;
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0 || !listingId) return;

  const stored = await saveFile(file);
  await prisma.listing.update({ where: { id: listingId }, data: { imageUrl: stored.path } });
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/admin");
}
