import type { Metadata } from "next";
import Link from "next/link";
import { Card, Notice, PageHeader } from "@/components/ui/surface";
import { OrganisationForm } from "@/features/organisations/components/forms";
import { getOrganisation } from "@/features/organisations/repository";
import { DueDayForm } from "@/features/reports/components/due-day-form";
import { requireSection } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: PageProps<"/o/[orgSlug]/settings">) {
  const { orgSlug } = await params;
  const { session, organisation } = await requireSection(orgSlug, "settings");
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
      <Card className="mt-6 max-w-2xl p-6">
        <h2 className="mb-5 font-semibold">Reports</h2>
        <DueDayForm orgId={organisation.id} day={details.report_due_day} />
      </Card>
    </>
  );
}
