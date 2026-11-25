import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, EmptyState } from "@/components/ui/surface";
import { listMyOrganisations } from "@/lib/auth/session";

export const metadata: Metadata = { title: "No organisation" };

export default async function NoOrganisationPage() {
  const organisations = await listMyOrganisations();
  if (organisations.some((o) => o.isOpen)) redirect("/");
  const blocked = organisations[0];
  const title = !blocked
    ? "You're not in an organisation yet"
    : blocked.status === "suspended"
      ? `${blocked.name} is suspended`
      : `Your access to ${blocked.name} is suspended`;
  return (
    <Card>
      <EmptyState
        icon={Building2}
        title={title}
        description={
          blocked
            ? "Contact your administrator for help."
            : "Open the invitation from your administrator to join one."
        }
      />
    </Card>
  );
}
