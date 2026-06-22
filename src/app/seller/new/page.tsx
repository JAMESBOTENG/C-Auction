import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ListingWizard } from "@/components/listing-wizard";

export default async function NewListingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SELLER") redirect("/listings");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">List a business</h1>
        <p className="text-muted-foreground">
          Provide your business profile and 3 years of financials. We normalize them into SDE and EBITDA.
        </p>
      </div>
      <ListingWizard />
    </div>
  );
}
