import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/surface";
import { getOrganisation } from "@/features/organisations/repository";
import { DeleteDraft } from "@/features/requests/components/request-actions";
import { RequestEditor } from "@/features/requests/components/request-editor";
import { getRequest, getRequestOptions } from "@/features/requests/repository";
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
  const [options, details] = await Promise.all([
    getRequestOptions(organisation.id),
    getOrganisation(organisation.id),
  ]);
  return (
    <>
      <Link href={base} className="text-muted mb-4 inline-block text-sm font-medium">
        ← Requests
      </Link>
      <PageHeader
        title="Ask for something"
        description="Saved as you type."
        action={request && <DeleteDraft id={request.id} slug={orgSlug} />}
      />
      <RequestEditor
        orgId={organisation.id}
        base={base}
        currency={details.currency}
        request={request}
        options={options}
      />
    </>
  );
}
