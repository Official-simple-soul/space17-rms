import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Notice, PageHeader } from "@/components/ui/surface";
import { listDepartments } from "@/features/departments/repository";
import { StartForm } from "@/features/requests/components/start-form";
import { listRequestableCategories } from "@/features/requests/repository";
import { getOrganisationContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New request" };

export default async function NewRequestPage({ params }: PageProps<"/o/[orgSlug]/requests/new">) {
  const { orgSlug } = await params;
  const { organisation, can } = await getOrganisationContext(orgSlug);
  if (!can("requests.create")) notFound();
  const [categories, departments] = await Promise.all([
    listRequestableCategories(organisation.id),
    listDepartments(organisation.id),
  ]);
  return (
    <>
      <Link
        href={`/o/${orgSlug}/requests`}
        className="text-muted mb-4 inline-block text-sm font-medium"
      >
        ← Requests
      </Link>
      <PageHeader title="New request" />
      <Card className="max-w-xl p-6">
        {categories.length ? (
          <StartForm
            orgId={organisation.id}
            slug={orgSlug}
            categories={categories}
            departments={departments}
          />
        ) : (
          <Notice>
            There&apos;s nothing you can request yet. Ask an admin to add you to a department and
            check that its categories are set up.
          </Notice>
        )}
      </Card>
    </>
  );
}
