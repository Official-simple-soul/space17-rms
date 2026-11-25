import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Notice, PageHeader } from "@/components/ui/surface";
import { OrganisationForm } from "@/features/organisations/components/forms";
import { getOrganisation } from "@/features/organisations/repository";
import { getOrganisationContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: PageProps<"/o/[orgSlug]/settings">) {
  const { orgSlug } = await params;
  const { session, organisation, can } = await getOrganisationContext(orgSlug);
  if (!can("org.manage")) notFound();
  const details = await getOrganisation(organisation.id);
  return (
    <>
      <PageHeader title="Settings" description="Details used across your organisation." />
      <Card className="max-w-2xl space-y-5 p-6">
        {session.aal !== "aal2" && (
          <Notice>
            Two-step verification is needed to save changes.{" "}
            <Link href="/account" className="font-medium underline">
              Set it up
            </Link>
          </Notice>
        )}
        <OrganisationForm organisation={details} />
      </Card>
    </>
  );
}
