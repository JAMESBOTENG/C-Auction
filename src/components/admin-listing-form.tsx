"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminCreateListing, adminUploadListingImage } from "@/app/admin/listings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select, Textarea } from "@/components/ui/misc";
import { ListingImage } from "@/components/listing-image";
import { ADD_BACK_CATEGORIES } from "@/lib/financials";
import { Trash2, Plus, ImageIcon, Building2, BarChart3, Layers, UploadCloud } from "lucide-react";

const CURRENT_YEAR = new Date().getFullYear();

interface OpexLine { label: string; amount: string }
interface YearForm { year: string; revenue: string; cogs: string; ownerSalary: string; opex: OpexLine[] }
interface AddBackForm { year: string; label: string; amount: string; category: string; note: string }

function emptyYear(y: number): YearForm {
  return { year: String(y), revenue: "", cogs: "", ownerSalary: "", opex: [{ label: "Payroll", amount: "" }, { label: "Rent", amount: "" }] };
}

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

export function AdminListingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [profile, setProfile] = useState({
    title: "", industry: "", state: "TX", yearFounded: "2005", employees: "",
    reasonForSale: "", askingPrice: "", publishNow: true, imageUrl: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
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
  function onPickFile(f: File | null) {
    setImageFile(f);
    setFilePreview((prev) => { if (prev) URL.revokeObjectURL(prev); return f ? URL.createObjectURL(f) : null; });
  }

  async function submit() {
    setError(null); setSubmitting(true);
    const res = await adminCreateListing({
      ...profile,
      publishNow: profile.publishNow,
      imageUrl: profile.imageUrl.trim() || null,
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

    if (!res.ok) { setSubmitting(false); setError(res.error); return; }

    // If a photo file was chosen, upload it to the freshly created listing.
    if (imageFile) {
      const fd = new FormData();
      fd.append("listingId", res.id);
      fd.append("file", imageFile);
      try { await adminUploadListingImage(fd); } catch { /* non-fatal */ }
    }
    router.push(`/listings/${res.id}`);
  }

  const previewSrc = filePreview || (profile.imageUrl.trim() || null);

  return (
    <div className="space-y-5">
      {/* 1. Business profile */}
      <FormCard step={1} icon={Building2} title="Business profile" subtitle="The headline details buyers see first.">
        <div className="grid gap-4 sm:grid-cols-2">
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
          <F label="Asking price (USD)" className="sm:col-span-2">
            <Input type="number" value={profile.askingPrice} onChange={(e) => setProfile({ ...profile, askingPrice: e.target.value })} placeholder="1500000" />
          </F>
          <F label="Reason for sale" className="sm:col-span-2">
            <Textarea value={profile.reasonForSale} onChange={(e) => setProfile({ ...profile, reasonForSale: e.target.value })} placeholder="Owner retiring after 25 years; no family successor." />
          </F>
        </div>
      </FormCard>

      {/* 2. Photo */}
      <FormCard step={2} icon={ImageIcon} title="Business photo" subtitle="Upload a photo, or paste an image URL. Skip it for an auto-designed cover.">
        <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
          {/* Live preview */}
          <div className="overflow-hidden rounded-xl border border-border/70 bg-muted">
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewSrc} alt="preview" className="h-32 w-full object-cover" />
            ) : (
              <ListingImage title={profile.title || "Your business"} industry={profile.industry} className="h-32" />
            )}
          </div>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/40 px-4 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
              <UploadCloud className="size-5" />
              {imageFile ? imageFile.name : "Click to upload a photo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
            </label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or paste a URL <span className="h-px flex-1 bg-border" />
            </div>
            <Input
              value={profile.imageUrl}
              onChange={(e) => setProfile({ ...profile, imageUrl: e.target.value })}
              placeholder="https://images.example.com/photo.jpg"
            />
          </div>
        </div>
      </FormCard>

      {/* 3. Financials */}
      <FormCard step={3} icon={BarChart3} title="Financial data — 3 years" subtitle="Revenue, COGS, owner salary and itemized operating expenses per year.">
        <div className="space-y-5">
          {years.map((y, i) => (
            <div key={i} className="rounded-xl border border-border/70 bg-secondary/30 p-4">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                Year {i + 1}
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <F label="Calendar year"><Input type="number" value={y.year} onChange={(e) => updateYear(i, { year: e.target.value })} /></F>
                <F label="Revenue ($)"><Input type="number" value={y.revenue} onChange={(e) => updateYear(i, { revenue: e.target.value })} placeholder="0" /></F>
                <F label="COGS ($)"><Input type="number" value={y.cogs} onChange={(e) => updateYear(i, { cogs: e.target.value })} placeholder="0" /></F>
                <F label="Owner salary ($)"><Input type="number" value={y.ownerSalary} onChange={(e) => updateYear(i, { ownerSalary: e.target.value })} placeholder="0" /></F>
              </div>
              <div className="mt-3 space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operating expense line items</Label>
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
        </div>
      </FormCard>

      {/* 4. Add-backs */}
      <FormCard
        step={4}
        icon={Layers}
        title="Add-backs"
        subtitle="Discretionary, one-time, non-cash, interest, tax and depreciation items."
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setAddBacks((xs) => [...xs, { year: years[years.length - 1].year, label: "", amount: "", category: "OWNER_COMP", note: "" }])}>
            <Plus className="size-4" /> Add row
          </Button>
        }
      >
        <div className="space-y-3">
          {addBacks.length === 0 && (
            <p className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-6 text-center text-sm text-muted-foreground">
              No add-backs yet. These increase SDE — add owner comp, personal expenses, one-time costs, interest, tax or D&amp;A.
            </p>
          )}
          {addBacks.map((a, i) => (
            <div key={i} className="grid items-end gap-2 rounded-xl border border-border/70 bg-secondary/30 p-3 sm:grid-cols-12">
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
              <div className="flex items-end sm:col-span-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => setAddBacks((xs) => xs.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </FormCard>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">{error}</div>
      )}

      {/* Sticky action bar */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-elevated backdrop-blur">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={profile.publishNow} onChange={(e) => setProfile({ ...profile, publishNow: e.target.checked })} className="h-4 w-4 accent-[var(--tw-accent,#6d4dfc)]" style={{ accentColor: "#6d4dfc" }} />
          Publish immediately as Verified
          <span className="text-muted-foreground">({profile.publishNow ? "live now" : "saved as draft"})</span>
        </label>
        <Button onClick={submit} disabled={submitting} size="lg">
          {submitting ? "Creating…" : "Create listing"}
        </Button>
      </div>
    </div>
  );
}

function FormCard({
  step, icon: Icon, title, subtitle, action, children,
}: {
  step: number; icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string;
  action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-card">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-violet to-brand-fuchsia text-white shadow-glow">
            <Icon className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold leading-tight">
              <span className="text-muted-foreground">{step}.</span> {title}
            </h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
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
