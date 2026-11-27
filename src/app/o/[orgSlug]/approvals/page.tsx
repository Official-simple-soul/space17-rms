import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/surface";
import { listCategories } from "@/features/categories/repository";
import { listDepartments } from "@/features/departments/repository";
import { getOrganisation } from "@/features/organisations/repository";
import { RequestsView } from "@/features/requests/components/requests-view";
import { listRequests } from "@/features/requests/repository";
import { requireSection } from "@/lib/auth/access";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/approvals">) {
  const { orgSlug } = await params;
  const { organisation } = await requireSection(orgSlug, "approvals");
  const [requests, categories, departments, details, view] = await Promise.all([
    listRequests(organisation.id, "inbox", await searchParams),
    listCategories(organisation.id),
    listDepartments(organisation.id),
    getOrganisation(organisation.id),
    getListView(),
  ]);
  return (
    <>
      <PageHeader title="Approvals" description="Requests waiting for you, oldest first." />
      <RequestsView
        mode="inbox"
        {...requests}
        view={view}
        base={`/o/${orgSlug}/requests`}
        currency={details.currency}
        now={new Date().toISOString()}
        categories={categories}
        departments={departments}
      />
    </>
  );
}
