import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminListingForm } from "@/components/admin-listing-form";

export default async function AdminNewListingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div className="space-y-1">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          Add a <span className="text-gradient">business</span>
        </h1>
        <p className="text-muted-foreground">
          Create a listing directly as the platform operator — profile, photo, and three years of
          financial data. Mark it verified to publish instantly.
        </p>
      </div>
      <AdminListingForm />
    </div>
  );
}
