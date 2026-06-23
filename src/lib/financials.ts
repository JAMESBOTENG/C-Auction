/**
 * Financial normalization engine — the core of Chronos.
 *
 * This module is pure (no IO, no framework deps) and fully unit-tested. It takes
 * messy owner-reported books and produces a transparent, itemized SDE and EBITDA
 * with an auditable add-back schedule, plus warnings for the verification workflow.
 *
 * Definitions used:
 *   Net profit (operating) = revenue - COGS - operating expenses - owner salary
 *     (owner salary is reported separately from opex in our intake)
 *   SDE   = net profit + owner salary + ALL add-backs
 *           (owner-comp, personal, one-time, non-cash, interest, tax, D&A, other)
 *   EBITDA = net profit + interest + taxes + depreciation + amortization
 *           (i.e. only the INTEREST/TAX/DEPRECIATION/AMORTIZATION add-back
 *            categories — owner comp and discretionary items are NOT added back)
 *
 * Every figure is returned itemized so the UI renders exactly how it was derived.
 */

export const ADD_BACK_CATEGORIES = [
  "OWNER_COMP",
  "PERSONAL_EXPENSE",
  "ONE_TIME",
  "NON_CASH",
  "INTEREST",
  "TAX",
  "DEPRECIATION",
  "AMORTIZATION",
  "OTHER",
] as const;

export type AddBackCategory = (typeof ADD_BACK_CATEGORIES)[number];

/** Categories that count toward EBITDA (added back to net profit). */
const EBITDA_CATEGORIES: AddBackCategory[] = [
  "INTEREST",
  "TAX",
  "DEPRECIATION",
  "AMORTIZATION",
];

export function isAddBackCategory(value: string): value is AddBackCategory {
  return (ADD_BACK_CATEGORIES as readonly string[]).includes(value);
}

export interface AddBackInput {
  label: string;
  amount: number;
  category: string;
  note?: string | null;
}

export interface YearFinancialsInput {
  year: number;
  revenue: number;
  cogs: number;
  /** Operating expense line items keyed by label. */
  operatingExpenses: Record<string, number>;
  ownerSalary: number;
  addBacks: AddBackInput[];
}

export interface NormalizedAddBack {
  label: string;
  amount: number;
  category: AddBackCategory;
  note?: string | null;
  /** True when category was not a recognized enum value (coerced to OTHER). */
  uncategorized: boolean;
}

export interface FinancialWarning {
  level: "warning" | "error";
  code: string;
  message: string;
}

export interface NormalizedYear {
  year: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  totalOperatingExpenses: number;
  operatingExpenses: Record<string, number>;
  ownerSalary: number;
  /** Operating net profit before any add-backs. */
  netProfit: number;

  addBacks: NormalizedAddBack[];
  totalAddBacks: number;

  /** Sum of add-backs that feed EBITDA (interest, tax, D&A). */
  ebitdaAddBacks: number;

  sde: number;
  ebitda: number;

  warnings: FinancialWarning[];
}

export interface NormalizedListingFinancials {
  years: NormalizedYear[];
  /** Most recent year — the basis for headline multiples. */
  latest: NormalizedYear | null;
  askingPrice: number;
  /** askingPrice / latest SDE, null if SDE <= 0. */
  sdeMultiple: number | null;
  /** askingPrice / latest EBITDA, null if EBITDA <= 0. */
  ebitdaMultiple: number | null;
  warnings: FinancialWarning[];
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sumValues(record: Record<string, number>): number {
  return Object.values(record).reduce((acc, v) => acc + (Number(v) || 0), 0);
}

/** Threshold above which an individual add-back is flagged for admin review. */
const LARGE_ADDBACK_REVENUE_PCT = 0.15;

export function normalizeYear(input: YearFinancialsInput): NormalizedYear {
  const warnings: FinancialWarning[] = [];

  const revenue = Number(input.revenue) || 0;
  const cogs = Number(input.cogs) || 0;
  const ownerSalary = Number(input.ownerSalary) || 0;
  const operatingExpenses = input.operatingExpenses ?? {};
  const totalOperatingExpenses = round2(sumValues(operatingExpenses));

  const grossProfit = round2(revenue - cogs);
  // Owner salary is held out of opex in our intake, so subtract it explicitly.
  const netProfit = round2(
    revenue - cogs - totalOperatingExpenses - ownerSalary
  );

  const addBacks: NormalizedAddBack[] = (input.addBacks ?? []).map((ab) => {
    const amount = Number(ab.amount) || 0;
    const valid = isAddBackCategory(ab.category);
    const category: AddBackCategory = valid
      ? (ab.category as AddBackCategory)
      : "OTHER";
    const uncategorized = !valid;

    if (uncategorized) {
      warnings.push({
        level: "warning",
        code: "UNCATEGORIZED_ADDBACK",
        message: `Add-back "${ab.label}" has an unrecognized category "${ab.category}" and was treated as OTHER.`,
      });
    }
    if (revenue > 0 && Math.abs(amount) > revenue * LARGE_ADDBACK_REVENUE_PCT) {
      warnings.push({
        level: "warning",
        code: "LARGE_ADDBACK",
        message: `Add-back "${ab.label}" (${amount.toLocaleString()}) exceeds ${
          LARGE_ADDBACK_REVENUE_PCT * 100
        }% of ${input.year} revenue — verify supporting docs.`,
      });
    }

    return { label: ab.label, amount, category, note: ab.note ?? null, uncategorized };
  });

  const totalAddBacks = round2(addBacks.reduce((acc, ab) => acc + ab.amount, 0));
  const ebitdaAddBacks = round2(
    addBacks
      .filter((ab) => EBITDA_CATEGORIES.includes(ab.category))
      .reduce((acc, ab) => acc + ab.amount, 0)
  );

  // SDE adds back owner salary plus every add-back. (Interest/tax/D&A are
  // captured as add-back categories per the spec, so they're inside totalAddBacks.)
  const sde = round2(netProfit + ownerSalary + totalAddBacks);
  // EBITDA adds back only interest, tax, depreciation, amortization.
  const ebitda = round2(netProfit + ebitdaAddBacks);

  if (sde <= 0) {
    warnings.push({
      level: "warning",
      code: "NON_POSITIVE_SDE",
      message: `${input.year} SDE is not positive (${sde.toLocaleString()}).`,
    });
  }

  return {
    year: input.year,
    revenue: round2(revenue),
    cogs: round2(cogs),
    grossProfit,
    totalOperatingExpenses,
    operatingExpenses,
    ownerSalary: round2(ownerSalary),
    netProfit,
    addBacks,
    totalAddBacks,
    ebitdaAddBacks,
    sde,
    ebitda,
    warnings,
  };
}

export function normalizeListing(
  yearsInput: YearFinancialsInput[],
  askingPrice: number
): NormalizedListingFinancials {
  const years = [...yearsInput]
    .map(normalizeYear)
    .sort((a, b) => a.year - b.year);

  const latest = years.length ? years[years.length - 1] : null;
  const price = Number(askingPrice) || 0;

  const sdeMultiple =
    latest && latest.sde > 0 ? round2(price / latest.sde) : null;
  const ebitdaMultiple =
    latest && latest.ebitda > 0 ? round2(price / latest.ebitda) : null;

  const warnings = years.flatMap((y) => y.warnings);

  return {
    years,
    latest,
    askingPrice: price,
    sdeMultiple,
    ebitdaMultiple,
    warnings,
  };
}
