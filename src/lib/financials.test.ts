import { describe, it, expect } from "vitest";
import {
  normalizeYear,
  normalizeListing,
  isAddBackCategory,
  type YearFinancialsInput,
} from "./financials";

const baseYear: YearFinancialsInput = {
  year: 2023,
  revenue: 1_000_000,
  cogs: 400_000,
  operatingExpenses: { rent: 60_000, payroll: 200_000, utilities: 20_000 },
  ownerSalary: 120_000,
  addBacks: [
    { label: "Owner health insurance", amount: 18_000, category: "OWNER_COMP" },
    { label: "Personal vehicle", amount: 12_000, category: "PERSONAL_EXPENSE" },
    { label: "One-time legal settlement", amount: 25_000, category: "ONE_TIME" },
    { label: "Depreciation", amount: 30_000, category: "DEPRECIATION" },
    { label: "Interest", amount: 15_000, category: "INTEREST" },
    { label: "Income tax", amount: 10_000, category: "TAX" },
  ],
};

describe("isAddBackCategory", () => {
  it("accepts valid categories and rejects junk", () => {
    expect(isAddBackCategory("OWNER_COMP")).toBe(true);
    expect(isAddBackCategory("NON_CASH")).toBe(true);
    expect(isAddBackCategory("nonsense")).toBe(false);
    expect(isAddBackCategory("")).toBe(false);
  });
});

describe("normalizeYear", () => {
  const y = normalizeYear(baseYear);

  it("computes gross profit and operating net profit", () => {
    // gross = 1,000,000 - 400,000 = 600,000
    expect(y.grossProfit).toBe(600_000);
    // opex total = 280,000; net = 600,000 - 280,000 - 120,000(owner) = 200,000
    expect(y.totalOperatingExpenses).toBe(280_000);
    expect(y.netProfit).toBe(200_000);
  });

  it("sums all add-backs for SDE", () => {
    // total addbacks = 18+12+25+30+15+10 = 110,000
    expect(y.totalAddBacks).toBe(110_000);
    // SDE = net 200,000 + owner 120,000 + addbacks 110,000 = 430,000
    expect(y.sde).toBe(430_000);
  });

  it("only adds back interest/tax/D&A for EBITDA", () => {
    // ebitda addbacks = 30(dep) + 15(int) + 10(tax) = 55,000
    expect(y.ebitdaAddBacks).toBe(55_000);
    // EBITDA = net 200,000 + 55,000 = 255,000
    expect(y.ebitda).toBe(255_000);
  });

  it("itemizes each add-back with its category", () => {
    expect(y.addBacks).toHaveLength(6);
    expect(y.addBacks.every((a) => !a.uncategorized)).toBe(true);
  });
});

describe("normalizeYear — messy inputs", () => {
  it("coerces unknown categories to OTHER and warns", () => {
    const y = normalizeYear({
      ...baseYear,
      addBacks: [{ label: "Mystery", amount: 5_000, category: "WHATEVER" }],
    });
    expect(y.addBacks[0].category).toBe("OTHER");
    expect(y.addBacks[0].uncategorized).toBe(true);
    expect(y.warnings.some((w) => w.code === "UNCATEGORIZED_ADDBACK")).toBe(true);
  });

  it("flags add-backs larger than 15% of revenue", () => {
    const y = normalizeYear({
      ...baseYear,
      addBacks: [{ label: "Huge", amount: 200_000, category: "ONE_TIME" }],
    });
    expect(y.warnings.some((w) => w.code === "LARGE_ADDBACK")).toBe(true);
  });

  it("handles missing/garbage numbers without throwing", () => {
    const y = normalizeYear({
      year: 2022,
      revenue: NaN as unknown as number,
      cogs: undefined as unknown as number,
      operatingExpenses: {},
      ownerSalary: undefined as unknown as number,
      addBacks: [{ label: "x", amount: NaN as unknown as number, category: "OTHER" }],
    });
    expect(y.revenue).toBe(0);
    expect(y.netProfit).toBe(0);
    expect(y.sde).toBe(0);
  });

  it("warns on non-positive SDE", () => {
    const y = normalizeYear({
      year: 2021,
      revenue: 100_000,
      cogs: 90_000,
      operatingExpenses: { rent: 50_000 },
      ownerSalary: 0,
      addBacks: [],
    });
    expect(y.sde).toBeLessThanOrEqual(0);
    expect(y.warnings.some((w) => w.code === "NON_POSITIVE_SDE")).toBe(true);
  });
});

describe("normalizeListing", () => {
  it("sorts years, picks latest, and computes both multiples", () => {
    const result = normalizeListing(
      [
        { ...baseYear, year: 2021 },
        { ...baseYear, year: 2023 },
        { ...baseYear, year: 2022 },
      ],
      2_150_000
    );
    expect(result.years.map((y) => y.year)).toEqual([2021, 2022, 2023]);
    expect(result.latest?.year).toBe(2023);
    // 2,150,000 / 430,000 = 5.0
    expect(result.sdeMultiple).toBe(5);
    // 2,150,000 / 255,000 ≈ 8.43
    expect(result.ebitdaMultiple).toBeCloseTo(8.43, 1);
  });

  it("returns null multiples when earnings are non-positive", () => {
    const result = normalizeListing(
      [
        {
          year: 2023,
          revenue: 50_000,
          cogs: 60_000,
          operatingExpenses: {},
          ownerSalary: 0,
          addBacks: [],
        },
      ],
      500_000
    );
    expect(result.sdeMultiple).toBeNull();
    expect(result.ebitdaMultiple).toBeNull();
  });

  it("handles empty input", () => {
    const result = normalizeListing([], 100_000);
    expect(result.latest).toBeNull();
    expect(result.sdeMultiple).toBeNull();
  });
});
