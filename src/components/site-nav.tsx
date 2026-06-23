import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

export async function SiteNav() {
  const session = await auth();
  const role = session?.user?.role;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 glass">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-violet via-brand-purple to-brand-fuchsia text-white shadow-glow transition-transform group-hover:scale-105">
            <ShieldCheck className="size-5" />
          </div>
          <span className="font-display text-lg font-extrabold tracking-tight">Chronos</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link href="/listings">
            <Button variant="ghost" size="sm" className="font-medium">Browse</Button>
          </Link>
          {role === "SELLER" && (
            <Link href="/seller">
              <Button variant="ghost" size="sm" className="font-medium">My Listings</Button>
            </Link>
          )}
          {role === "BUYER" && (
            <Link href="/buyer">
              <Button variant="ghost" size="sm" className="font-medium">My Deals</Button>
            </Link>
          )}
          {role === "ADMIN" && (
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="font-medium">Admin</Button>
            </Link>
          )}

          <div className="mx-2 h-5 w-px bg-border" />

          {session?.user ? (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="text-xs font-semibold leading-none">{session.user.name}</div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-primary/70">{role}</div>
              </div>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button variant="outline" size="sm" type="submit">Sign out</Button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button size="sm">Sign in</Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
