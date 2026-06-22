import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

export async function SiteNav() {
  const session = await auth();
  const role = session?.user?.role;

  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur-sm shadow-card">
      <div className="container flex h-15 items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-2.5 text-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Building2 className="size-4 text-primary-foreground" />
          </div>
          <span className="text-base font-bold tracking-tight">Succession</span>
        </Link>

        <nav className="flex items-center gap-0.5">
          <Link href="/listings">
            <Button variant="ghost" size="sm" className="text-sm font-medium">Browse</Button>
          </Link>
          {role === "SELLER" && (
            <Link href="/seller">
              <Button variant="ghost" size="sm" className="text-sm font-medium">My Listings</Button>
            </Link>
          )}
          {role === "BUYER" && (
            <Link href="/buyer">
              <Button variant="ghost" size="sm" className="text-sm font-medium">My Deals</Button>
            </Link>
          )}
          {role === "ADMIN" && (
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-sm font-medium">Admin</Button>
            </Link>
          )}

          <div className="ml-2 h-5 w-px bg-border" />

          {session?.user ? (
            <div className="ml-2 flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <div className="text-xs font-semibold leading-none">{session.user.name}</div>
                <div className="text-xs text-muted-foreground">{role}</div>
              </div>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button variant="outline" size="sm" type="submit" className="text-xs">Sign out</Button>
              </form>
            </div>
          ) : (
            <div className="ml-2 flex items-center gap-2">
              <Link href="/login">
                <Button size="sm" className="text-xs">Sign in</Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
