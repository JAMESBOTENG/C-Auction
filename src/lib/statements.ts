/**
 * Financial *statements* builder — turns the normalized engine output into a
 * spreadsheet-style workbook (Income Statement, Balance Sheet, Cash Flow,
 * Forecast). Pure (no IO, no framework deps) so it can run on the server and be
 * unit-tested. The Income Statement reflects the real reported figures; the
 * Balance Sheet and Cash Flow are clearly-labelled illustrative models derived
 * deterministically from revenue, margins and add-backs (we don't capture a
 * full balance sheet at intake), and the Forecast projects historical CAGR
 * forward at constant margins.
 */

import type {
  NormalizedListingFinancials,
  NormalizedYear,
} from "@/lib/financials";

export type CellFormat = "currency" | "percent" | "number" | "multiple";
export type RowKind = "normal" | "section" | "subtotal" | "total" | "spacer";

export interface SheetRow {
  label: string;
  /** One value per column; null renders as an empty/“—” cell. */
  values: (number | null)[];
  kind?: RowKind;
  /** Indent level for nested line items. */
  indent?: number;
  format?: CellFormat;
}

export interface Sheet {
  /** Tab name, e.g. "Income Statement". */
  name: string;
  /** Short tab label + accent colour for the Excel-style tab. */
  short: string;
  accent: string;
  columns: string[];
  rows: SheetRow[];
  note?: string;
}

export interface Workbook {
  sheets: Sheet[];
}

function r(n: number): number {
  return Math.round(n);
}

function pct(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}

/** Depreciation + amortization add-backs for a year. */
function depAmort(y: NormalizedYear): number {
  return y.addBacks
    .filter((a) => a.category === "DEPRECIATION" || a.category === "AMORTIZATION")
    .reduce((s, a) => s + a.amount, 0);
}

function interestExpense(y: NormalizedYear): number {
  return y.addBacks
    .filter((a) => a.category === "INTEREST")
    .reduce((s, a) => s + a.amount, 0);
}

const SPACER: SheetRow = { label: "", values: [], kind: "spacer" };

// ---------------------------------------------------------------------------
// Income Statement — real reported figures
// ---------------------------------------------------------------------------
export function buildIncomeStatement(fin: NormalizedListingFinancials): Sheet {
  const years = fin.years;
  const columns = years.map((y) => `FY ${y.year}`);

  // Union of operating-expense labels, in first-seen order.
  const opexLabels: string[] = [];
  for (const y of years) {
    for (const label of Object.keys(y.operatingExpenses)) {
      if (!opexLabels.includes(label)) opexLabels.push(label);
    }
  }

  const rows: SheetRow[] = [
    { label: "Revenue", values: years.map((y) => y.revenue), format: "currency" },
    { label: "Cost of goods sold", values: years.map((y) => -y.cogs), format: "currency" },
    { label: "Gross profit", values: years.map((y) => y.grossProfit), kind: "total", format: "currency" },
    { label: "Gross margin", values: years.map((y) => pct(y.grossProfit, y.revenue)), format: "percent" },
    { label: "Operating expenses", values: [], kind: "section" },
    ...opexLabels.map((label) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      values: years.map((y) => {
        const v = y.operatingExpenses[label];
        return v === undefined ? null : -v;
      }),
      indent: 1,
      format: "currency" as CellFormat,
    })),
    { label: "Total operating expenses", values: years.map((y) => -y.totalOperatingExpenses), kind: "subtotal", format: "currency" },
    { label: "Owner's compensation", values: years.map((y) => -y.ownerSalary), format: "currency" },
    { label: "Operating income", values: years.map((y) => y.netProfit), kind: "total", format: "currency" },
    SPACER,
    { label: "Seller's Discretionary Earnings (SDE)", values: years.map((y) => y.sde), kind: "total", format: "currency" },
    { label: "SDE margin", values: years.map((y) => pct(y.sde, y.revenue)), format: "percent" },
    { label: "EBITDA", values: years.map((y) => y.ebitda), kind: "total", format: "currency" },
    { label: "EBITDA margin", values: years.map((y) => pct(y.ebitda, y.revenue)), format: "percent" },
  ];

  return {
    name: "Income Statement",
    short: "Income Statement",
    accent: "#059669",
    columns,
    rows,
    note: "Reported figures. SDE & EBITDA are normalized earnings — see the add-back schedule below for the full itemized bridge.",
  };
}

// ---------------------------------------------------------------------------
// Balance Sheet — illustrative model
// ---------------------------------------------------------------------------
interface BSModel {
  cash: number; ar: number; inventory: number; currentAssets: number;
  ppe: number; intangibles: number; totalAssets: number;
  ap: number; accrued: number; currentLiab: number;
  debt: number; totalLiab: number; equity: number;
}

function modelBalanceSheet(y: NormalizedYear): BSModel {
  const cash = r(y.revenue * 0.09);
  const ar = r(y.revenue * 0.11);
  const inventory = r(y.cogs * 0.12);
  const currentAssets = cash + ar + inventory;
  const ppe = r(y.revenue * 0.22);
  const intangibles = r(y.revenue * 0.05);
  const totalAssets = currentAssets + ppe + intangibles;

  const ap = r(y.cogs * 0.1);
  const accrued = r(y.revenue * 0.045);
  const currentLiab = ap + accrued;
  const interest = interestExpense(y);
  const debt = interest > 0 ? r(interest / 0.075) : r(y.revenue * 0.08);
  const totalLiab = currentLiab + debt;
  const equity = totalAssets - totalLiab; // plug to balance

  return { cash, ar, inventory, currentAssets, ppe, intangibles, totalAssets, ap, accrued, currentLiab, debt, totalLiab, equity };
}

export function buildBalanceSheet(fin: NormalizedListingFinancials): Sheet {
  const years = fin.years;
  const columns = years.map((y) => `FY ${y.year}`);
  const m = years.map(modelBalanceSheet);

  const rows: SheetRow[] = [
    { label: "Assets", values: [], kind: "section" },
    { label: "Cash & equivalents", values: m.map((b) => b.cash), indent: 1, format: "currency" },
    { label: "Accounts receivable", values: m.map((b) => b.ar), indent: 1, format: "currency" },
    { label: "Inventory", values: m.map((b) => b.inventory), indent: 1, format: "currency" },
    { label: "Total current assets", values: m.map((b) => b.currentAssets), kind: "subtotal", format: "currency" },
    { label: "Property & equipment, net", values: m.map((b) => b.ppe), indent: 1, format: "currency" },
    { label: "Intangible assets", values: m.map((b) => b.intangibles), indent: 1, format: "currency" },
    { label: "Total assets", values: m.map((b) => b.totalAssets), kind: "total", format: "currency" },
    SPACER,
    { label: "Liabilities", values: [], kind: "section" },
    { label: "Accounts payable", values: m.map((b) => b.ap), indent: 1, format: "currency" },
    { label: "Accrued liabilities", values: m.map((b) => b.accrued), indent: 1, format: "currency" },
    { label: "Total current liabilities", values: m.map((b) => b.currentLiab), kind: "subtotal", format: "currency" },
    { label: "Long-term debt", values: m.map((b) => b.debt), indent: 1, format: "currency" },
    { label: "Total liabilities", values: m.map((b) => b.totalLiab), kind: "subtotal", format: "currency" },
    SPACER,
    { label: "Equity", values: [], kind: "section" },
    { label: "Shareholders' equity", values: m.map((b) => b.equity), indent: 1, format: "currency" },
    { label: "Total liabilities & equity", values: m.map((b) => b.totalLiab + b.equity), kind: "total", format: "currency" },
  ];

  return {
    name: "Balance Sheet",
    short: "Balance Sheet",
    accent: "#1d4ed8",
    columns,
    rows,
    note: "Illustrative balance sheet modeled from reported revenue, margins and add-backs — shown for demonstration.",
  };
}

// ---------------------------------------------------------------------------
// Cash Flow — illustrative model
// ---------------------------------------------------------------------------
export function buildCashFlow(fin: NormalizedListingFinancials): Sheet {
  const years = fin.years;
  const columns = years.map((y) => `FY ${y.year}`);
  const bs = years.map(modelBalanceSheet);

  const wcDelta: (number | null)[] = years.map((y, i) => {
    if (i === 0) return null;
    const cur = bs[i], prev = bs[i - 1];
    const change = cur.ar - prev.ar + (cur.inventory - prev.inventory) - (cur.ap - prev.ap);
    return -change; // an increase in working capital uses cash
  });

  const da = years.map(depAmort);
  const capex = da.map((d) => -r(d * 1.15));
  const opCash = years.map((y, i) => y.netProfit + da[i] + (wcDelta[i] ?? 0));
  const fcf = opCash.map((c, i) => c + capex[i]);

  const rows: SheetRow[] = [
    { label: "Operating income", values: years.map((y) => y.netProfit), format: "currency" },
    { label: "Add: depreciation & amortization", values: da, indent: 1, format: "currency" },
    { label: "Changes in working capital", values: wcDelta, indent: 1, format: "currency" },
    { label: "Net cash from operations", values: opCash, kind: "total", format: "currency" },
    { label: "Less: capital expenditures", values: capex, indent: 1, format: "currency" },
    { label: "Free cash flow", values: fcf, kind: "total", format: "currency" },
  ];

  return {
    name: "Cash Flow",
    short: "Cash Flow",
    accent: "#0891b2",
    columns,
    rows,
    note: "Illustrative indirect cash-flow model derived from operating income, add-backs and modeled working capital.",
  };
}

// ---------------------------------------------------------------------------
// Forecast — historical CAGR projected forward at constant margins
// ---------------------------------------------------------------------------
export function buildForecast(fin: NormalizedListingFinancials, horizon = 3): Sheet {
  const years = fin.years;
  const latest = fin.latest!;
  const first = years[0];

  let cagr = 0.06;
  if (years.length >= 2 && first.revenue > 0) {
    const raw = Math.pow(latest.revenue / first.revenue, 1 / (years.length - 1)) - 1;
    cagr = Math.min(0.15, Math.max(0.03, raw));
  }

  const grossMargin = latest.revenue ? latest.grossProfit / latest.revenue : 0;
  const sdeMargin = latest.revenue ? latest.sde / latest.revenue : 0;
  const ebitdaMargin = latest.revenue ? latest.ebitda / latest.revenue : 0;

  const proj = Array.from({ length: horizon }, (_, k) => {
    const factor = Math.pow(1 + cagr, k + 1);
    const revenue = r(latest.revenue * factor);
    return {
      year: latest.year + k + 1,
      revenue,
      grossProfit: r(revenue * grossMargin),
      ebitda: r(revenue * ebitdaMargin),
      sde: r(revenue * sdeMargin),
    };
  });

  const columns = proj.map((p) => `FY ${p.year}E`);
  const rows: SheetRow[] = [
    { label: "Revenue", values: proj.map((p) => p.revenue), format: "currency" },
    { label: "Gross profit", values: proj.map((p) => p.grossProfit), format: "currency" },
    { label: "EBITDA", values: proj.map((p) => p.ebitda), kind: "total", format: "currency" },
    { label: "Seller's Discretionary Earnings", values: proj.map((p) => p.sde), kind: "total", format: "currency" },
    SPACER,
    { label: "Revenue growth", values: proj.map(() => Math.round(cagr * 1000) / 10), format: "percent" },
  ];

  return {
    name: "Forecast",
    short: "Forecast",
    accent: "#7c3aed",
    columns,
    rows,
    note: `Projection assumes ${(cagr * 100).toFixed(1)}% annual revenue growth (3-yr historical CAGR) with FY ${latest.year} margins held constant. Illustrative — not a guarantee of future results.`,
  };
}

export function buildWorkbook(fin: NormalizedListingFinancials | null | undefined): Workbook {
  if (!fin || !fin.latest || fin.years.length === 0) return { sheets: [] };
  return {
    sheets: [
      buildIncomeStatement(fin),
      buildBalanceSheet(fin),
      buildCashFlow(fin),
      buildForecast(fin),
    ],
  };
}
