import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

export async function SiteNav() {
  const session = await auth();
  const role = session?.user?.role;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Building2 className="size-5" />
          <span>Succession</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/listings">
            <Button variant="ghost" size="sm">Browse</Button>
          </Link>
          {role === "SELLER" && (
            <Link href="/seller">
              <Button variant="ghost" size="sm">My Listings</Button>
            </Link>
          )}
          {role === "BUYER" && (
            <Link href="/buyer">
              <Button variant="ghost" size="sm">My Deals</Button>
            </Link>
          )}
          {role === "ADMIN" && (
            <Link href="/admin">
              <Button variant="ghost" size="sm">Admin</Button>
            </Link>
          )}
          {session?.user ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <span className="mx-2 text-xs text-muted-foreground">
                {session.user.name} · {role}
              </span>
              <Button variant="outline" size="sm" type="submit">Sign out</Button>
            </form>
          ) : (
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
