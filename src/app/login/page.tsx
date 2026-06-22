"use client";

import { useActionState } from "react";
import { useState } from "react";
import { loginAction, registerAction, type AuthState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/misc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, undefined);

  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle>{mode === "login" ? "Sign in" : "Create an account"}</CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Access verified deals, your listings, or the admin queue."
              : "Register as a buyer or seller to get started."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
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
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
          </button>

          {mode === "login" && (
            <div className="mt-6 rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Demo logins (password: password123)</p>
              <p>admin@succession.test · seller1@succession.test · buyer1@succession.test</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
