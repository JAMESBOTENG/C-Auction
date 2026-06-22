import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/utils";
import { normalizeListing, type YearFinancialsInput } from "@/lib/financials";

/** Loads a listing's financials + add-backs and runs them through the engine. */
export async function getNormalizedFinancials(listingId: string) {
  const [financials, addBacks] = await Promise.all([
    prisma.financials.findMany({ where: { listingId }, orderBy: { year: "asc" } }),
    prisma.addBack.findMany({ where: { listingId } }),
  ]);

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return null;

  const years: YearFinancialsInput[] = financials.map((f) => ({
    year: f.year,
    revenue: f.revenue,
    cogs: f.cogs,
    operatingExpenses: parseJson<Record<string, number>>(f.operatingExpenses, {}),
    ownerSalary: f.ownerSalary,
    addBacks: addBacks
      .filter((a) => a.year === f.year)
      .map((a) => ({ label: a.label, amount: a.amount, category: a.category, note: a.note })),
  }));

  return normalizeListing(years, listing.askingPrice);
}
