import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Notice, PageHeader } from "@/components/ui/surface";
import { listDepartments } from "@/features/departments/repository";
import { getOrganisation } from "@/features/organisations/repository";
import { DeleteDraft } from "@/features/requests/components/request-actions";
import { RequestEditor } from "@/features/requests/components/request-editor";
import {
  getRequest,
  listRequestableCategories,
  previewSteps,
} from "@/features/requests/repository";
import { getOrganisationContext } from "@/lib/auth/session";
import { text } from "@/lib/server-page";

export const metadata: Metadata = { title: "New request" };

export default async function NewRequestPage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/requests/new">) {
  const { orgSlug } = await params;
  const draft = text((await searchParams).draft);
  const { organisation, can } = await getOrganisationContext(orgSlug);
  if (!can("requests.create")) notFound();
  const base = `/o/${orgSlug}/requests`;
  const request = draft ? await getRequest(organisation.id, draft) : null;
  if (draft && !request?.is_requester) notFound();
  if (request && request.status !== "draft") redirect(`${base}/${request.id}`);
  const [categories, departments, details, steps] = await Promise.all([
    listRequestableCategories(organisation.id),
    listDepartments(organisation.id),
    getOrganisation(organisation.id),
    request ? previewSteps(request.category.id, request.total_minor) : [],
  ]);
  return (
    <>
      <Link href={base} className="text-muted mb-4 inline-block text-sm font-medium">
        ← Requests
      </Link>
      <PageHeader
        title="New request"
        description="Saved as you type."
        action={request && <DeleteDraft id={request.id} slug={orgSlug} />}
      />
      {categories.length || request ? (
        <RequestEditor
          orgId={organisation.id}
          base={base}
          currency={details.currency}
          request={request}
          categories={categories}
          departments={departments}
          initialSteps={steps}
        />
      ) : (
        <Notice>
          There&apos;s nothing you can request yet. Ask an admin to add you to a department and
          check that its categories are set up.
        </Notice>
      )}
    </>
  );
}
