import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/surface";
import { AuditView } from "@/features/audit/components/audit-view";
import { AUDIT_LIMIT, listAudit } from "@/features/audit/repository";
import { getOrganisationContext } from "@/lib/auth/session";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ params }: PageProps<"/o/[orgSlug]/audit">) {
  const { orgSlug } = await params;
  const { organisation, can } = await getOrganisationContext(orgSlug);
  if (!can("audit.view")) notFound();
  const [rows, view] = await Promise.all([listAudit(organisation.id), getListView()]);
  return (
    <>
      <PageHeader
        title="Audit log"
        description={`A permanent record of important changes. Showing the latest ${AUDIT_LIMIT}.`}
      />
      <AuditView rows={rows} view={view} />
    </>
  );
}
