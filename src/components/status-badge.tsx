import { Badge } from "@/components/ui/misc";

const map: Record<string, { variant: "secondary" | "warning" | "success" | "destructive"; label: string }> = {
  DRAFT: { variant: "secondary", label: "Draft" },
  PENDING_REVIEW: { variant: "warning", label: "Pending review" },
  VERIFIED: { variant: "success", label: "Verified" },
  REJECTED: { variant: "destructive", label: "Rejected" },
};

export function StatusBadge({ status }: { status: string }) {
  const m = map[status] ?? { variant: "secondary" as const, label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
