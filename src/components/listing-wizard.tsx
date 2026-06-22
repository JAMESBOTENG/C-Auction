"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createListing } from "@/app/seller/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select, Textarea } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ADD_BACK_CATEGORIES } from "@/lib/financials";
import { Trash2, Plus } from "lucide-react";

interface OpexLine { label: string; amount: string }
interface YearForm {
  year: string;
  revenue: string;
  cogs: string;
  ownerSalary: string;
  opex: OpexLine[];
}
interface AddBackForm { year: string; label: string; amount: string; category: string; note: string }

const CURRENT_YEAR = new Date().getFullYear();

function emptyYear(year: number): YearForm {
  return {
    year: String(year),
    revenue: "",
    cogs: "",
    ownerSalary: "",
    opex: [{ label: "Payroll", amount: "" }, { label: "Rent", amount: "" }],
  };
}

const STEPS = ["Business profile", "Financials", "Add-backs", "Review & submit"];

export function ListingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [profile, setProfile] = useState({
    title: "",
    industry: "",
    state: "",
    yearFounded: "",
    employees: "",
    reasonForSale: "",
    askingPrice: "",
  });

  // Step 2 — three years
  const [years, setYears] = useState<YearForm[]>([
    emptyYear(CURRENT_YEAR - 2),
    emptyYear(CURRENT_YEAR - 1),
    emptyYear(CURRENT_YEAR),
  ]);

  // Step 3
  const [addBacks, setAddBacks] = useState<AddBackForm[]>([]);

  function updateYear(i: number, patch: Partial<YearForm>) {
    setYears((ys) => ys.map((y, idx) => (idx === i ? { ...y, ...patch } : y)));
  }
  function updateOpex(yi: number, oi: number, patch: Partial<OpexLine>) {
    setYears((ys) =>
      ys.map((y, idx) =>
        idx === yi ? { ...y, opex: y.opex.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : y
      )
    );
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    const payload = {
      ...profile,
      years: years.map((y) => ({
        year: Number(y.year),
        revenue: Number(y.revenue),
        cogs: Number(y.cogs),
        ownerSalary: Number(y.ownerSalary),
        operatingExpenses: Object.fromEntries(
          y.opex.filter((o) => o.label.trim()).map((o) => [o.label.trim(), Number(o.amount) || 0])
        ),
      })),
      addBacks: addBacks.map((a) => ({
        year: Number(a.year),
        label: a.label,
        amount: Number(a.amount),
        category: a.category,
        note: a.note,
      })),
    };
    const res = await createListing(payload);
    setSubmitting(false);
    if (res.ok) {
      router.push(`/seller/${res.id}`);
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded-full px-3 py-1 ${
              i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card>
          <CardHeader><CardTitle>Business profile</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Listing title" className="sm:col-span-2">
              <Input value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} placeholder="Established Residential HVAC Contractor" />
            </Field>
            <Field label="Industry">
              <Input value={profile.industry} onChange={(e) => setProfile({ ...profile, industry: e.target.value })} placeholder="Residential HVAC" />
            </Field>
            <Field label="State">
              <Input value={profile.state} onChange={(e) => setProfile({ ...profile, state: e.target.value })} placeholder="TX" maxLength={2} />
            </Field>
            <Field label="Year founded">
              <Input type="number" value={profile.yearFounded} onChange={(e) => setProfile({ ...profile, yearFounded: e.target.value })} />
            </Field>
            <Field label="Employees">
              <Input type="number" value={profile.employees} onChange={(e) => setProfile({ ...profile, employees: e.target.value })} />
            </Field>
            <Field label="Asking price (USD)">
              <Input type="number" value={profile.askingPrice} onChange={(e) => setProfile({ ...profile, askingPrice: e.target.value })} />
            </Field>
            <Field label="Reason for sale" className="sm:col-span-2">
              <Textarea value={profile.reasonForSale} onChange={(e) => setProfile({ ...profile, reasonForSale: e.target.value })} placeholder="Owner retiring after 25 years; no family successor." />
            </Field>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {years.map((y, i) => (
            <Card key={i}>
              <CardHeader><CardTitle>Financials — Year {i + 1}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-4">
                  <Field label="Year"><Input type="number" value={y.year} onChange={(e) => updateYear(i, { year: e.target.value })} /></Field>
                  <Field label="Revenue"><Input type="number" value={y.revenue} onChange={(e) => updateYear(i, { revenue: e.target.value })} /></Field>
                  <Field label="COGS"><Input type="number" value={y.cogs} onChange={(e) => updateYear(i, { cogs: e.target.value })} /></Field>
                  <Field label="Owner salary"><Input type="number" value={y.ownerSalary} onChange={(e) => updateYear(i, { ownerSalary: e.target.value })} /></Field>
                </div>
                <div>
                  <Label>Operating expense line items</Label>
                  <div className="mt-2 space-y-2">
                    {y.opex.map((o, oi) => (
                      <div key={oi} className="flex gap-2">
                        <Input placeholder="Label (e.g. Rent)" value={o.label} onChange={(e) => updateOpex(i, oi, { label: e.target.value })} />
                        <Input type="number" placeholder="Amount" value={o.amount} onChange={(e) => updateOpex(i, oi, { amount: e.target.value })} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => updateYear(i, { opex: y.opex.filter((_, j) => j !== oi) })}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => updateYear(i, { opex: [...y.opex, { label: "", amount: "" }] })}>
                      <Plus className="size-4" /> Add line item
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Add-backs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              List discretionary, one-time and non-cash items, plus interest, taxes and depreciation/amortization. Each is categorized so we can compute SDE and EBITDA correctly.
            </p>
            {addBacks.map((a, i) => (
              <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-12">
                <Select className="sm:col-span-2" value={a.year} onChange={(e) => setAddBacks((xs) => xs.map((x, j) => j === i ? { ...x, year: e.target.value } : x))}>
                  {years.map((y) => <option key={y.year} value={y.year}>{y.year}</option>)}
                </Select>
                <Input className="sm:col-span-3" placeholder="Label" value={a.label} onChange={(e) => setAddBacks((xs) => xs.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <Input className="sm:col-span-2" type="number" placeholder="Amount" value={a.amount} onChange={(e) => setAddBacks((xs) => xs.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                <Select className="sm:col-span-2" value={a.category} onChange={(e) => setAddBacks((xs) => xs.map((x, j) => j === i ? { ...x, category: e.target.value } : x))}>
                  {ADD_BACK_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                </Select>
                <Input className="sm:col-span-2" placeholder="Note" value={a.note} onChange={(e) => setAddBacks((xs) => xs.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} />
                <Button type="button" variant="ghost" size="icon" className="sm:col-span-1" onClick={() => setAddBacks((xs) => xs.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setAddBacks((xs) => [...xs, { year: years[years.length - 1].year, label: "", amount: "", category: "OWNER_COMP", note: "" }])}>
              <Plus className="size-4" /> Add add-back
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Review & submit</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>{profile.title || "(untitled)"}</strong> — {profile.industry}, {profile.state}</p>
            <p>Asking price: ${Number(profile.askingPrice || 0).toLocaleString()}</p>
            <p>{years.length} years of financials · {addBacks.length} add-backs</p>
            <p className="text-muted-foreground">
              On submit the listing is created as a DRAFT. From its management page you can upload supporting
              documents and submit it for admin verification.
            </p>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
        ) : (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Creating…" : "Create listing"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
