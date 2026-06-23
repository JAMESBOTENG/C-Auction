import { describe, it, expect } from "vitest";
import { normalizeListing, type YearFinancialsInput } from "./financials";
import {
  buildIncomeStatement,
  buildBalanceSheet,
  buildCashFlow,
  buildForecast,
  buildWorkbook,
} from "./statements";

const years: YearFinancialsInput[] = [
  {
    year: 2021,
    revenue: 2_000_000,
    cogs: 1_000_000,
    operatingExpenses: { payroll: 300_000, rent: 60_000 },
    ownerSalary: 150_000,
    addBacks: [
      { label: "Depreciation", amount: 40_000, category: "DEPRECIATION" },
      { label: "Interest", amount: 15_000, category: "INTEREST" },
      { label: "Owner auto", amount: 12_000, category: "PERSONAL_EXPENSE" },
    ],
  },
  {
    year: 2023,
    revenue: 2_600_000,
    cogs: 1_300_000,
    operatingExpenses: { payroll: 360_000, rent: 66_000, marketing: 40_000 },
    ownerSalary: 170_000,
    addBacks: [
      { label: "Depreciation", amount: 48_000, category: "DEPRECIATION" },
      { label: "Interest", amount: 12_000, category: "INTEREST" },
      { label: "Owner auto", amount: 13_000, category: "PERSONAL_EXPENSE" },
    ],
  },
];

const fin = normalizeListing(years, 3_000_000);

describe("buildIncomeStatement", () => {
  const sheet = buildIncomeStatement(fin);

  it("has a column per reported year, sorted ascending", () => {
    expect(sheet.columns).toEqual(["FY 2021", "FY 2023"]);
  });

  it("matches the engine's gross profit, SDE and EBITDA", () => {
    const gp = sheet.rows.find((r) => r.label === "Gross profit")!;
    const sde = sheet.rows.find((r) => r.label.includes("SDE"))!;
    const ebitda = sheet.rows.find((r) => r.label === "EBITDA")!;
    expect(gp.values).toEqual(fin.years.map((y) => y.grossProfit));
    expect(sde.values).toEqual(fin.years.map((y) => y.sde));
    expect(ebitda.values).toEqual(fin.years.map((y) => y.ebitda));
  });

  it("unions operating-expense line items across years", () => {
    const labels = sheet.rows.filter((r) => r.indent === 1).map((r) => r.label.toLowerCase());
    expect(labels).toContain("payroll");
    expect(labels).toContain("rent");
    expect(labels).toContain("marketing");
  });
});

describe("buildBalanceSheet", () => {
  const sheet = buildBalanceSheet(fin);

  it("balances: total assets equals total liabilities & equity for every year", () => {
    const assets = sheet.rows.find((r) => r.label === "Total assets")!;
    const liabEq = sheet.rows.find((r) => r.label === "Total liabilities & equity")!;
    assets.values.forEach((v, i) => expect(liabEq.values[i]).toBe(v));
  });
});

describe("buildCashFlow", () => {
  const sheet = buildCashFlow(fin);

  it("has no working-capital delta for the first year", () => {
    const wc = sheet.rows.find((r) => r.label === "Changes in working capital")!;
    expect(wc.values[0]).toBeNull();
    expect(typeof wc.values[1]).toBe("number");
  });
});

describe("buildForecast", () => {
  const sheet = buildForecast(fin);

  it("projects the requested horizon of future years that grow", () => {
    expect(sheet.columns).toHaveLength(3);
    const revenue = sheet.rows.find((r) => r.label === "Revenue")!.values as number[];
    expect(revenue[0]).toBeGreaterThan(fin.latest!.revenue);
    expect(revenue[2]).toBeGreaterThan(revenue[0]);
  });
});

describe("buildWorkbook", () => {
  it("returns the four statement sheets", () => {
    const wb = buildWorkbook(fin);
    expect(wb.sheets.map((s) => s.name)).toEqual([
      "Income Statement",
      "Balance Sheet",
      "Cash Flow",
      "Forecast",
    ]);
  });

  it("returns an empty workbook when there are no financials", () => {
    expect(buildWorkbook(null).sheets).toHaveLength(0);
    expect(buildWorkbook(normalizeListing([], 0)).sheets).toHaveLength(0);
  });
});
