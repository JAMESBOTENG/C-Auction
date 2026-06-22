import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminListingForm } from "@/components/admin-listing-form";

export default async function AdminNewListingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add a business listing</h1>
        <p className="text-muted-foreground">
          Create a listing directly as the platform operator. You can mark it as verified immediately.
        </p>
      </div>
      <AdminListingForm />
    </div>
  );
}
