"use client";

import { useActionState } from "react";
import { requestUnlock, type ActionState } from "@/app/listings/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/misc";

export function UnlockForm({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestUnlock, undefined);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="listingId" value={listingId} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="nda" className="mt-0.5" required />
        <span>
          I accept the non-disclosure agreement and agree to keep all financials and documents
          confidential. (Acceptance is timestamped.)
        </span>
      </label>
      <div className="space-y-1.5">
        <Label htmlFor="pof-amount">Proof of funds — amount available (USD)</Label>
        <Input id="pof-amount" name="proofOfFundsAmount" type="number" min={1} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pof-source">Source of funds</Label>
        <Input
          id="pof-source"
          name="proofOfFundsSource"
          placeholder="e.g. SBA 7(a) pre-qual + personal equity"
          required
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Self-attested for this MVP — no bank verification is performed.
      </p>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">{state.success}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit NDA + proof of funds"}
      </Button>
    </form>
  );
}
