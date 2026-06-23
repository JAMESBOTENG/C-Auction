import { cn } from "@/lib/utils";

interface Point {
  label: string;
  revenue: number;
  sde: number;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

/**
 * Lightweight, dependency-free SVG chart: revenue as bars, SDE as an overlaid
 * line. Used to give listings a clean, finance-grade performance graphic.
 */
export function TrendChart({ data, className }: { data: Point[]; className?: string }) {
  if (data.length === 0) return null;

  const W = 640;
  const H = 260;
  const left = 16;
  const right = 16;
  const top = 46;
  const bottom = 34;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const plotBottom = top + plotH;

  const max = Math.max(...data.map((d) => Math.max(d.revenue, d.sde))) * 1.15 || 1;
  const n = data.length;
  const slot = plotW / n;
  const barW = Math.min(slot * 0.4, 88);

  const x = (i: number) => left + slot * (i + 0.5);
  const y = (v: number) => plotBottom - (v / max) * plotH;

  const sdePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.sde).toFixed(1)}`).join(" ");
  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => plotBottom - f * plotH);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("h-auto w-full", className)} role="img" aria-label="Revenue and SDE trend">
      <defs>
        <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>

      {/* gridlines */}
      {gridLines.map((gy, i) => (
        <line key={i} x1={left} y1={gy} x2={W - right} y2={gy} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="3 4" />
      ))}

      {/* legend */}
      <g transform={`translate(${left}, 22)`} fontFamily="Inter, sans-serif">
        <rect x={0} y={-9} width={11} height={11} rx={2} fill="url(#barFill)" />
        <text x={17} y={1} fontSize={12} fontWeight={600} fill="#334155">Revenue</text>
        <line x1={92} y1={-4} x2={112} y2={-4} stroke="#059669" strokeWidth={3} strokeLinecap="round" />
        <circle cx={102} cy={-4} r={3.5} fill="#059669" />
        <text x={120} y={1} fontSize={12} fontWeight={600} fill="#334155">SDE</text>
      </g>

      {/* bars + value labels */}
      {data.map((d, i) => {
        const barH = (d.revenue / max) * plotH;
        return (
          <g key={d.label}>
            <rect x={x(i) - barW / 2} y={plotBottom - barH} width={barW} height={barH} rx={5} fill="url(#barFill)" />
            <text x={x(i)} y={plotBottom - barH - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1e3a8a" fontFamily="IBM Plex Mono, monospace">
              {compact(d.revenue)}
            </text>
            <text x={x(i)} y={plotBottom + 20} textAnchor="middle" fontSize={12} fontWeight={600} fill="#64748b" fontFamily="Inter, sans-serif">
              {d.label}
            </text>
          </g>
        );
      })}

      {/* SDE line */}
      <path d={sdePath} fill="none" stroke="#059669" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={`p-${d.label}`}>
          <circle cx={x(i)} cy={y(d.sde)} r={4.5} fill="#fff" stroke="#059669" strokeWidth={2.5} />
          <text x={x(i)} y={y(d.sde) - 12} textAnchor="middle" fontSize={11} fontWeight={700} fill="#059669" fontFamily="IBM Plex Mono, monospace">
            {compact(d.sde)}
          </text>
        </g>
      ))}
    </svg>
  );
}
