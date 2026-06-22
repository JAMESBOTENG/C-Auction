import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success",
        className
      )}
      title="Financials normalized and verified against supporting documents"
    >
      <ShieldCheck className="size-3.5" />
      Financials Verified
    </span>
  );
}
