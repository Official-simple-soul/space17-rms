import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { ConfigurationHeader } from "@/features/configuration/components/configuration-header";
import { WorkflowsView } from "@/features/workflows/components/workflows-view";
import { listWorkflowDetails } from "@/features/workflows/repository";
import { requireConfiguration } from "@/lib/auth/configuration";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "Workflows" };

export default async function WorkflowsPage({
  params,
}: PageProps<"/o/[orgSlug]/configuration/workflows">) {
  const { orgSlug } = await params;
  const { organisation } = await requireConfiguration(orgSlug);
  const [rows, view] = await Promise.all([listWorkflowDetails(organisation.id), getListView()]);
  const base = `/o/${orgSlug}/configuration/workflows`;
  return (
    <>
      <ConfigurationHeader
        slug={orgSlug}
        current="workflows"
        action={
          <Link href={`${base}/new`} className={buttonStyles({ variant: "brand" })}>
            <Plus className="size-4" aria-hidden />
            New workflow
          </Link>
        }
      />
      <WorkflowsView rows={rows} view={view} base={base} />
    </>
  );
}
