"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminCreateListing } from "@/app/admin/listings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select, Textarea } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ADD_BACK_CATEGORIES } from "@/lib/financials";
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";

const CURRENT_YEAR = new Date().getFullYear();

interface OpexLine { label: string; amount: string }
interface YearForm {
  year: string; revenue: string; cogs: string; ownerSalary: string; opex: OpexLine[];
}
interface AddBackForm { year: string; label: string; amount: string; category: string; note: string }

function emptyYear(y: number): YearForm {
  return { year: String(y), revenue: "", cogs: "", ownerSalary: "", opex: [{ label: "Payroll", amount: "" }, { label: "Rent", amount: "" }] };
}

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

export function AdminListingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openSection, setOpenSection] = useState<"profile" | "financials" | "addbacks">("profile");

  const [profile, setProfile] = useState({
    title: "", industry: "", state: "TX", yearFounded: "2005", employees: "",
    reasonForSale: "", askingPrice: "", publishNow: true, imageUrl: "",
  });
  const [years, setYears] = useState<YearForm[]>([
    emptyYear(CURRENT_YEAR - 2), emptyYear(CURRENT_YEAR - 1), emptyYear(CURRENT_YEAR),
  ]);
  const [addBacks, setAddBacks] = useState<AddBackForm[]>([]);

  function updateYear(i: number, patch: Partial<YearForm>) {
    setYears((ys) => ys.map((y, idx) => (idx === i ? { ...y, ...patch } : y)));
  }
  function updateOpex(yi: number, oi: number, patch: Partial<OpexLine>) {
    setYears((ys) => ys.map((y, idx) => idx === yi
      ? { ...y, opex: y.opex.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : y));
  }
  function updateAB(i: number, patch: Partial<AddBackForm>) {
    setAddBacks((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  async function submit() {
    setError(null); setSubmitting(true);
    const res = await adminCreateListing({
      ...profile,
      publishNow: profile.publishNow,
      imageUrl: profile.imageUrl || null,
      years: years.map((y) => ({
        year: Number(y.year), revenue: Number(y.revenue), cogs: Number(y.cogs),
        ownerSalary: Number(y.ownerSalary),
        operatingExpenses: Object.fromEntries(
          y.opex.filter((o) => o.label.trim()).map((o) => [o.label.trim(), Number(o.amount) || 0])
        ),
      })),
      addBacks: addBacks.map((a) => ({
        year: Number(a.year), label: a.label, amount: Number(a.amount),
        category: a.category, note: a.note,
      })),
    });
    setSubmitting(false);
    if (res.ok) router.push(`/listings/${res.id}`);
    else setError(res.error);
  }

  const Section = ({ id, title, children }: { id: typeof openSection; title: string; children: React.ReactNode }) => (
    <Card className="shadow-card">
      <button
        type="button"
        className="flex w-full items-center justify-between p-6 text-left"
        onClick={() => setOpenSection(openSection === id ? id : id)}
      >
        <CardTitle>{title}</CardTitle>
        {openSection === id ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>
      {openSection === id && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Business Profile */}
      <Card className="shadow-card" onClick={() => setOpenSection("profile")}>
        <CardHeader><CardTitle>1. Business profile</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <F label="Listing title" className="sm:col-span-2">
            <Input value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} placeholder="e.g. Established Residential HVAC Contractor" />
          </F>
          <F label="Industry">
            <Input value={profile.industry} onChange={(e) => setProfile({ ...profile, industry: e.target.value })} placeholder="e.g. Residential HVAC" />
          </F>
          <F label="State">
            <Select value={profile.state} onChange={(e) => setProfile({ ...profile, state: e.target.value })}>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </F>
          <F label="Year founded">
            <Input type="number" value={profile.yearFounded} onChange={(e) => setProfile({ ...profile, yearFounded: e.target.value })} />
          </F>
          <F label="Employees">
            <Input type="number" value={profile.employees} onChange={(e) => setProfile({ ...profile, employees: e.target.value })} />
          </F>
          <F label="Asking price (USD)">
            <Input type="number" value={profile.askingPrice} onChange={(e) => setProfile({ ...profile, askingPrice: e.target.value })} placeholder="1500000" />
          </F>
          <F label="Image URL (optional)" className="sm:col-span-2">
            <Input value={profile.imageUrl} onChange={(e) => setProfile({ ...profile, imageUrl: e.target.value })} placeholder="https://… or leave blank for auto placeholder" />
          </F>
          <F label="Reason for sale" className="sm:col-span-2">
            <Textarea value={profile.reasonForSale} onChange={(e) => setProfile({ ...profile, reasonForSale: e.target.value })} placeholder="Owner retiring after 25 years; no family successor." />
          </F>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" id="publishNow" checked={profile.publishNow} onChange={(e) => setProfile({ ...profile, publishNow: e.target.checked })} className="h-4 w-4" />
            <label htmlFor="publishNow" className="text-sm font-medium">Publish immediately as Verified (skip review workflow)</label>
          </div>
        </CardContent>
      </Card>

      {/* Financials */}
      <Card className="shadow-card">
        <CardHeader><CardTitle>2. Financials (3 years)</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {years.map((y, i) => (
            <div key={i} className="space-y-4 rounded-lg border p-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Year {i + 1}</h4>
              <div className="grid gap-3 sm:grid-cols-4">
                <F label="Calendar year"><Input type="number" value={y.year} onChange={(e) => updateYear(i, { year: e.target.value })} /></F>
                <F label="Revenue ($)"><Input type="number" value={y.revenue} onChange={(e) => updateYear(i, { revenue: e.target.value })} placeholder="0" /></F>
                <F label="COGS ($)"><Input type="number" value={y.cogs} onChange={(e) => updateYear(i, { cogs: e.target.value })} placeholder="0" /></F>
                <F label="Owner salary ($)"><Input type="number" value={y.ownerSalary} onChange={(e) => updateYear(i, { ownerSalary: e.target.value })} placeholder="0" /></F>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operating expense line items</Label>
                {y.opex.map((o, oi) => (
                  <div key={oi} className="flex gap-2">
                    <Input className="flex-1" placeholder="Label (e.g. Payroll)" value={o.label} onChange={(e) => updateOpex(i, oi, { label: e.target.value })} />
                    <Input className="w-36" type="number" placeholder="Amount" value={o.amount} onChange={(e) => updateOpex(i, oi, { amount: e.target.value })} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => updateYear(i, { opex: y.opex.filter((_, j) => j !== oi) })}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => updateYear(i, { opex: [...y.opex, { label: "", amount: "" }] })}>
                  <Plus className="size-4" /> Add expense line
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Add-backs */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>3. Add-backs</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => setAddBacks((xs) => [...xs, { year: years[years.length - 1].year, label: "", amount: "", category: "OWNER_COMP", note: "" }])}>
              <Plus className="size-4" /> Add row
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {addBacks.length === 0 && (
            <p className="text-sm text-muted-foreground">No add-backs yet. Add discretionary, one-time, non-cash, interest, tax, or depreciation items.</p>
          )}
          {addBacks.map((a, i) => (
            <div key={i} className="grid items-end gap-2 rounded-lg border p-3 sm:grid-cols-12">
              <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Year</Label>
                <Select value={a.year} onChange={(e) => updateAB(i, { year: e.target.value })}>
                  {years.map((y) => <option key={y.year} value={y.year}>{y.year}</option>)}
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-3"><Label className="text-xs">Label</Label>
                <Input placeholder="e.g. Owner health insurance" value={a.label} onChange={(e) => updateAB(i, { label: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Amount ($)</Label>
                <Input type="number" value={a.amount} onChange={(e) => updateAB(i, { amount: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Category</Label>
                <Select value={a.category} onChange={(e) => updateAB(i, { category: e.target.value })}>
                  {ADD_BACK_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Note</Label>
                <Input placeholder="Optional" value={a.note} onChange={(e) => updateAB(i, { note: e.target.value })} />
              </div>
              <div className="sm:col-span-1 flex items-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => setAddBacks((xs) => xs.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      <div className="flex items-center justify-between rounded-xl border bg-card p-5 shadow-card">
        <p className="text-sm text-muted-foreground">
          {profile.publishNow ? "Will be published as Verified immediately." : "Will be saved as Draft for review."}
        </p>
        <Button onClick={submit} disabled={submitting} size="lg">
          {submitting ? "Creating…" : "Create listing"}
        </Button>
      </div>
    </div>
  );
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
