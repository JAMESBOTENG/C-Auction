import { type NormalizedListingFinancials, type NormalizedYear } from "@/lib/financials";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

/**
 * Renders the full, auditable derivation of SDE and EBITDA for the latest year,
 * plus a 3-year trend. Every component is itemized — never just a final number.
 */
export function FinancialSchedule({
  fin,
  showWarnings = false,
}: {
  fin: NormalizedListingFinancials;
  showWarnings?: boolean;
}) {
  const latest = fin.latest;
  if (!latest) return <p className="text-muted-foreground">No financials available.</p>;

  return (
    <div className="space-y-8">
      {showWarnings && fin.warnings.length > 0 && (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 font-medium text-amber-800">
            <AlertTriangle className="size-4" /> Verification flags
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
            {fin.warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      <ScheduleBlock year={latest} />

      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          3-Year trend
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm tabular">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Year</th>
                <th className="py-2 pr-4 text-right font-medium">Revenue</th>
                <th className="py-2 pr-4 text-right font-medium">Gross profit</th>
                <th className="py-2 pr-4 text-right font-medium">Net profit</th>
                <th className="py-2 pr-4 text-right font-medium">SDE</th>
                <th className="py-2 text-right font-medium">EBITDA</th>
              </tr>
            </thead>
            <tbody>
              {fin.years.map((y) => (
                <tr key={y.year} className="border-b last:border-0">
                  <td className="py-2 pr-4">{y.year}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(y.revenue)}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(y.grossProfit)}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(y.netProfit)}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{formatCurrency(y.sde)}</td>
                  <td className="py-2 text-right font-semibold">{formatCurrency(y.ebitda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, indent }: { label: string; value: number; bold?: boolean; indent?: boolean }) {
  return (
    <tr className={bold ? "border-t font-semibold" : ""}>
      <td className={`py-1.5 ${indent ? "pl-4" : ""}`}>{label}</td>
      <td className="py-1.5 text-right">{formatCurrency(value)}</td>
    </tr>
  );
}

function ScheduleBlock({ year }: { year: NormalizedYear }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          SDE derivation · {year.year}
        </h4>
        <table className="w-full text-sm tabular">
          <tbody>
            <Row label="Revenue" value={year.revenue} />
            <Row label="Less: COGS" value={-year.cogs} indent />
            <Row label="Gross profit" value={year.grossProfit} />
            <Row label="Less: operating expenses" value={-year.totalOperatingExpenses} indent />
            <Row label="Less: owner salary" value={-year.ownerSalary} indent />
            <Row label="Net profit" value={year.netProfit} bold />
            <Row label="Add back: owner salary" value={year.ownerSalary} indent />
            <Row label="Add back: total add-backs" value={year.totalAddBacks} indent />
            <Row label="Seller's Discretionary Earnings (SDE)" value={year.sde} bold />
          </tbody>
        </table>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          EBITDA derivation · {year.year}
        </h4>
        <table className="w-full text-sm tabular">
          <tbody>
            <Row label="Net profit" value={year.netProfit} />
            <Row label="Add back: interest, tax, D&A" value={year.ebitdaAddBacks} indent />
            <Row label="EBITDA" value={year.ebitda} bold />
          </tbody>
        </table>

        <h4 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Add-back schedule · {year.year}
        </h4>
        <table className="w-full text-sm tabular">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1.5 pr-2 font-medium">Item</th>
              <th className="py-1.5 pr-2 font-medium">Category</th>
              <th className="py-1.5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {year.addBacks.map((ab, i) => (
              <tr key={i} className="border-b last:border-0 align-top">
                <td className="py-1.5 pr-2">
                  {ab.label}
                  {ab.note && <div className="text-xs text-muted-foreground">{ab.note}</div>}
                </td>
                <td className="py-1.5 pr-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {ab.category.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="py-1.5 text-right">{formatCurrency(ab.amount)}</td>
              </tr>
            ))}
            <Row label="Total add-backs" value={year.totalAddBacks} bold />
          </tbody>
        </table>
      </div>
    </div>
  );
}
