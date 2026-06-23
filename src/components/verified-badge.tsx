import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1 text-xs font-semibold text-white shadow-sm ring-1 ring-emerald-500/20",
        className
      )}
      title="Financials normalized and verified against supporting documents"
    >
      <ShieldCheck className="size-3.5" />
      Financials Verified
    </span>
  );
}
