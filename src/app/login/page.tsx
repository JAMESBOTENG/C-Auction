"use client";

import { useActionState } from "react";
import { useState } from "react";
import { loginAction, registerAction, type AuthState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/misc";
import { ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, undefined);

  return (
    <div className="mx-auto grid max-w-5xl items-center gap-10 py-8 lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden rounded-3xl bg-brand-mesh p-10 text-white shadow-elevated lg:block">
        <div className="absolute inset-0 cover-grain opacity-30" />
        <div className="relative space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30 backdrop-blur">
              <ShieldCheck className="size-5" />
            </div>
            <span className="font-display text-xl font-extrabold">Chronos</span>
          </div>
          <h2 className="font-display text-3xl font-extrabold leading-tight">
            Buy a business with financials you can trust.
          </h2>
          <ul className="space-y-3 text-sm text-white/85">
            {[
              "Normalized, itemized SDE & EBITDA on every deal",
              "Human-verified against source documents",
              "NDA-gated data rooms and private deal chat",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form panel */}
      <div className="mx-auto w-full max-w-md rounded-3xl border border-border/70 bg-card p-8 shadow-elevated">
        <h1 className="font-display text-2xl font-extrabold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login"
            ? "Access verified deals, your listings, or the admin queue."
            : "Register as a buyer or seller to get started."}
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" name="name" required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="role">I am a</Label>
              <Select id="role" name="role" defaultValue="BUYER">
                <option value="BUYER">Buyer (acquirer / search fund)</option>
                <option value="SELLER">Seller (owner or broker)</option>
              </Select>
            </div>
          )}
          {state?.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-primary"
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>

        {mode === "login" && (
          <div className="mt-6 rounded-xl border border-border/70 bg-secondary/50 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-semibold text-foreground">Demo logins (password: password123)</p>
            <p>admin@chronos.test · seller1@chronos.test · buyer1@chronos.test</p>
          </div>
        )}
      </div>
    </div>
  );
}
