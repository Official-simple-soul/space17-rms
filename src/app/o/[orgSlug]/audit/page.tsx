import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/surface";
import { AuditView } from "@/features/audit/components/audit-view";
import { listAudit, listAuditFilters } from "@/features/audit/repository";
import { getOrganisationContext } from "@/lib/auth/session";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ params, searchParams }: PageProps<"/o/[orgSlug]/audit">) {
  const { orgSlug } = await params;
  const { organisation, can } = await getOrganisationContext(orgSlug);
  if (!can("audit.view")) notFound();
  const query = await searchParams;
  const [audit, filters, view] = await Promise.all([
    listAudit(organisation.id, query),
    listAuditFilters(organisation.id),
    getListView(),
  ]);
  return (
    <>
      <PageHeader title="Audit log" description="A permanent record of important changes." />
      <AuditView {...audit} {...filters} view={view} />
    </>
  );
}
