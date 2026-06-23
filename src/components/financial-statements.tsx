"use client";

import { useState } from "react";
import { Table2 } from "lucide-react";
import type { Workbook, Sheet, SheetRow, CellFormat } from "@/lib/statements";
import { cn } from "@/lib/utils";

function fmtCell(v: number | null | undefined, format: CellFormat = "currency"): string {
  if (v === null || v === undefined) return "—";
  if (format === "percent") return `${v.toFixed(1)}%`;
  if (format === "multiple") return `${v.toFixed(2)}×`;
  if (format === "number") return v.toLocaleString("en-US");
  const s = Math.abs(v).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return v < 0 ? `(${s})` : s;
}

const colLetter = (i: number) => String.fromCharCode(66 + i); // B, C, D … (A is the label column)

export function FinancialStatements({ workbook }: { workbook: Workbook }) {
  const [active, setActive] = useState(0);
  if (!workbook.sheets.length) {
    return <p className="text-sm text-muted-foreground">No financials available.</p>;
  }
  const sheet = workbook.sheets[active];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-card">
      {/* Workbook title bar */}
      <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-white">
            <Table2 className="size-3.5" />
          </span>
          <span className="font-mono text-xs font-semibold text-slate-600">Financials.xlsx</span>
        </div>
        <span className="hidden font-mono text-[11px] text-slate-400 sm:inline">
          {sheet.name} · {sheet.columns.length} periods
        </span>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <SheetGrid sheet={sheet} />
      </div>

      {sheet.note && (
        <p className="border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[11px] italic leading-snug text-slate-500">
          {sheet.note}
        </p>
      )}

      {/* Sheet tabs (bottom, Excel-style) */}
      <div className="flex items-stretch gap-0 overflow-x-auto border-t border-slate-300 bg-slate-100 px-2 pt-1">
        {workbook.sheets.map((s, i) => (
          <button
            key={s.name}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "group flex items-center gap-1.5 whitespace-nowrap rounded-t-md border border-b-0 px-3 py-1.5 text-xs font-semibold transition-colors",
              i === active
                ? "border-slate-300 bg-white text-slate-800"
                : "border-transparent text-slate-500 hover:bg-slate-200/60 hover:text-slate-700"
            )}
            style={i === active ? { boxShadow: `inset 0 2px 0 0 ${s.accent}` } : undefined}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.accent }} />
            {s.short}
          </button>
        ))}
      </div>
    </div>
  );
}

function SheetGrid({ sheet }: { sheet: Sheet }) {
  const nCols = sheet.columns.length;
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        {/* Column-letter strip */}
        <tr className="select-none">
          <th className="w-9 border border-slate-200 bg-slate-100 px-0 py-1 text-center font-mono text-[10px] font-normal text-slate-400" />
          <th className="border border-slate-200 bg-slate-100 px-3 py-1 text-left font-mono text-[10px] font-normal text-slate-400">A</th>
          {sheet.columns.map((_, i) => (
            <th key={i} className="border border-slate-200 bg-slate-100 px-3 py-1 text-right font-mono text-[10px] font-normal text-slate-400">
              {colLetter(i)}
            </th>
          ))}
        </tr>
        {/* Period header */}
        <tr>
          <th className="w-9 border border-slate-200 bg-slate-100 px-0 py-2 text-center font-mono text-[10px] font-normal text-slate-400">1</th>
          <th className="border border-slate-200 bg-slate-700 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-white">
            Line item
          </th>
          {sheet.columns.map((c) => (
            <th key={c} className="border border-slate-200 bg-slate-700 px-3 py-2 text-right font-mono text-xs font-semibold text-white">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sheet.rows.map((row, ri) => (
          <Row key={ri} row={row} rowNumber={ri + 2} nCols={nCols} />
        ))}
      </tbody>
    </table>
  );
}

function Row({ row, rowNumber, nCols }: { row: SheetRow; rowNumber: number; nCols: number }) {
  if (row.kind === "spacer") {
    return (
      <tr>
        <td className="w-9 border border-slate-200 bg-slate-100 py-1 text-center font-mono text-[10px] text-slate-400">{rowNumber}</td>
        <td colSpan={nCols + 1} className="border border-slate-200 bg-white py-1" />
      </tr>
    );
  }

  if (row.kind === "section") {
    return (
      <tr>
        <td className="w-9 border border-slate-200 bg-slate-100 py-1.5 text-center font-mono text-[10px] text-slate-400">{rowNumber}</td>
        <td colSpan={nCols + 1} className="border border-slate-200 bg-slate-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
          {row.label}
        </td>
      </tr>
    );
  }

  const isTotal = row.kind === "total";
  const isSubtotal = row.kind === "subtotal";
  const isPercent = row.format === "percent";

  const rowCls = cn(
    isTotal && "bg-blue-50/70",
    !isTotal && !isSubtotal && "bg-white hover:bg-slate-50"
  );
  const labelCls = cn(
    "border border-slate-200 px-3 py-1.5 text-left",
    isTotal && "border-t-2 border-t-slate-400 font-bold text-slate-900",
    isSubtotal && "border-t border-t-slate-300 font-semibold text-slate-800",
    !isTotal && !isSubtotal && (isPercent ? "italic text-slate-500" : "text-slate-700")
  );

  return (
    <tr className={rowCls}>
      <td className="w-9 border border-slate-200 bg-slate-100 py-1.5 text-center font-mono text-[10px] text-slate-400">{rowNumber}</td>
      <td className={labelCls} style={row.indent ? { paddingLeft: `${row.indent * 1.25 + 0.75}rem` } : undefined}>
        {row.label}
      </td>
      {row.values.map((v, i) => {
        const neg = typeof v === "number" && v < 0 && row.format !== "percent";
        return (
          <td
            key={i}
            className={cn(
              "border border-slate-200 px-3 py-1.5 text-right font-mono tabular",
              isTotal && "border-t-2 border-t-slate-400 font-bold",
              isSubtotal && "border-t border-t-slate-300 font-semibold",
              isPercent && "text-xs italic text-slate-500",
              neg && "text-rose-600",
              !neg && isTotal && "text-slate-900",
              !neg && !isTotal && !isPercent && "text-slate-700"
            )}
          >
            {fmtCell(v, row.format)}
          </td>
        );
      })}
    </tr>
  );
}
