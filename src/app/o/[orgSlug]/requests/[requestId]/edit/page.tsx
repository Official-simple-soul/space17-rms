import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Notice, PageHeader } from "@/components/ui/surface";
import { listDepartments } from "@/features/departments/repository";
import { DeleteDraft } from "@/features/requests/components/request-actions";
import { RequestEditor } from "@/features/requests/components/request-editor";
import {
  getRequest,
  listRequestableCategories,
  previewSteps,
} from "@/features/requests/repository";
import { getOrganisationContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Edit request" };

export default async function EditRequestPage({
  params,
}: PageProps<"/o/[orgSlug]/requests/[requestId]/edit">) {
  const { orgSlug, requestId } = await params;
  const { organisation, can } = await getOrganisationContext(orgSlug);
  const request = await getRequest(organisation.id, requestId);
  if (!request?.is_requester || !can("requests.create")) notFound();
  const base = `/o/${orgSlug}/requests`;
  if (request.status !== "draft" && request.status !== "returned")
    redirect(`${base}/${request.id}`);
  const [categories, departments, steps] = await Promise.all([
    listRequestableCategories(organisation.id),
    listDepartments(organisation.id),
    previewSteps(request.category.id, request.total_minor),
  ]);
  const reason = request.events.find((e) => e.type === "returned");
  return (
    <>
      <Link
        href={request.status === "draft" ? base : `${base}/${request.id}`}
        className="text-muted mb-4 inline-block text-sm font-medium"
      >
        ← Back
      </Link>
      <PageHeader
        title={request.number ? `Edit ${request.number}` : "New request"}
        description="Saved as you type."
        action={request.status === "draft" && <DeleteDraft id={request.id} slug={orgSlug} />}
      />
      {request.status === "returned" && reason && (
        <div className="mb-6">
          <Notice tone="alert">
            {reason.actor} returned this: {reason.body}
          </Notice>
        </div>
      )}
      <RequestEditor
        orgId={organisation.id}
        base={base}
        currency={request.currency}
        request={request}
        categories={categories}
        departments={departments}
        initialSteps={steps}
      />
    </>
  );
}
