import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/surface";
import { AuditView } from "@/features/audit/components/audit-view";
import { listAudit, listAuditFilters } from "@/features/audit/repository";
import { requireSection } from "@/lib/auth/access";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ params, searchParams }: PageProps<"/o/[orgSlug]/audit">) {
  const { orgSlug } = await params;
  const { organisation } = await requireSection(orgSlug, "audit");
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
