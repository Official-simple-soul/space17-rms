import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { listAudit } from "@/features/audit/repository";
import { getOrganisationContext } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ params }: PageProps<"/o/[orgSlug]/audit">) {
  const { orgSlug } = await params;
  const { organisation, can } = await getOrganisationContext(orgSlug);
  if (!can("audit.view")) notFound();
  const entries = await listAudit(organisation.id);
  return (
    <>
      <PageHeader
        title="Audit log"
        description="A permanent record of important changes. Showing the latest 50."
      />
      <Card>
        {entries.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Nothing yet"
            description="Changes will appear here."
          />
        ) : (
          <ol className="divide-line divide-y">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 p-5 text-sm"
              >
                <div>
                  <p className="font-medium first-letter:uppercase">
                    {e.action.replace(/[._]/g, " ")}
                  </p>
                  {e.reason && <p className="text-muted">{e.reason}</p>}
                </div>
                <time dateTime={e.created_at} className="text-muted">
                  {formatDateTime(e.created_at)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
