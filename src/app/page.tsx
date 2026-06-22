import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, FileSpreadsheet, Lock } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="mx-auto max-w-3xl space-y-6 pt-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Verified, standardized financials
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          The marketplace for acquiring retiring owners&apos; businesses — with financials you can trust.
        </h1>
        <p className="text-lg text-muted-foreground">
          Every listing&apos;s messy owner books are normalized into a defensible SDE and EBITDA with an
          itemized, auditable add-back schedule and a human verification workflow. No junk listings, no
          guesswork.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/listings">
            <Button size="lg">Browse verified deals</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">Sign in</Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <FileSpreadsheet className="size-6 text-primary" />
            <CardTitle>Normalized financials</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Three years of revenue, COGS, opex, owner comp and add-backs become a transparent SDE and
            EBITDA — every figure itemized so you see exactly how it was derived.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <ShieldCheck className="size-6 text-success" />
            <CardTitle>Human-verified</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Sellers upload tax returns and P&amp;Ls. Our admins review the add-back schedule and supporting
            docs before a listing earns the &ldquo;Financials Verified&rdquo; badge.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Lock className="size-6 text-primary" />
            <CardTitle>Gated data rooms</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Accept an NDA and attest proof of funds to unlock full financials, documents and a private deal
            room with the seller.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
