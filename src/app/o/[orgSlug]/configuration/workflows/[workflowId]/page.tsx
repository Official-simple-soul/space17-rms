import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Notice, PageHeader } from "@/components/ui/surface";
import { VersionHistory } from "@/features/configuration/components/version-history";
import { getOrganisation } from "@/features/organisations/repository";
import { listRoles } from "@/features/roles/repository";
import { listSetupWarnings } from "@/features/setup/repository";
import { describeWarning } from "@/features/setup/warnings";
import {
  ArchiveWorkflow,
  WorkflowEditor,
  type ApproverOptions,
} from "@/features/workflows/components/workflow-editor";
import { getWorkflow, listApprovers } from "@/features/workflows/repository";
import { APPROVE_PERMISSION } from "@/features/workflows/schema";
import { requireSection } from "@/lib/auth/access";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Workflow" };

export default async function WorkflowPage({
  params,
}: PageProps<"/o/[orgSlug]/configuration/workflows/[workflowId]">) {
  const { orgSlug, workflowId } = await params;
  const { organisation } = await requireSection(orgSlug, "configuration");
  const id = organisation.id;
  const [workflow, details, roles, requestPeople, reportPeople, warnings] = await Promise.all([
    getWorkflow(id, workflowId),
    getOrganisation(id),
    listRoles(id),
    listApprovers(id, APPROVE_PERMISSION.request),
    listApprovers(id, APPROVE_PERMISSION.report),
    listSetupWarnings(id),
  ]);
  if (!workflow && workflowId !== "new") notFound();
  const rolesWith = (key: string) =>
    roles
      .filter((r) => r.permissions.some((p) => p.key === key))
      .map((r) => ({ id: r.id, name: r.name }));
  const options: ApproverOptions = {
    request: { roles: rolesWith(APPROVE_PERMISSION.request), people: requestPeople },
    report: { roles: rolesWith(APPROVE_PERMISSION.report), people: reportPeople },
  };
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const personName = new Map([...requestPeople, ...reportPeople].map((p) => [p.id, p.name]));
  const stuck = warnings.filter((w) => w.code === "workflow_step" && w.subject_id === workflow?.id);
  return (
    <>
      <Link
        href={`/o/${orgSlug}/configuration/workflows`}
        className="text-muted mb-4 inline-block text-sm font-medium"
      >
        ← Workflows
      </Link>
      <PageHeader
        title={workflow?.name ?? "New workflow"}
        description={
          workflow
            ? `Version ${workflow.version}. Items already in approval keep their version.`
            : "Decide who approves, in what order and from what amount."
        }
      />
      {stuck.length > 0 && (
        <div className="mb-6 space-y-2">
          {stuck.map((w) => (
            <Notice key={w.subject} tone="alert">
              {describeWarning(w, `/o/${orgSlug}`).text}
            </Notice>
          ))}
        </div>
      )}
      <WorkflowEditor
        orgId={id}
        slug={orgSlug}
        currency={details.currency}
        options={options}
        workflow={
          workflow
            ? {
                id: workflow.id,
                name: workflow.name,
                subject: workflow.subject,
                version: workflow.version,
                steps: workflow.steps,
              }
            : undefined
        }
      />
      {workflow && (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <VersionHistory
            versions={workflow.history.map((v) => ({
              version: v.version,
              publishedAt: v.publishedAt,
              content: (
                <ol className="space-y-4 text-sm">
                  {v.steps.map((s, i) => (
                    <li key={i}>
                      <span className="font-medium">
                        {i + 1}. {s.name}
                      </span>
                      <span className="text-muted block">
                        {s.role_id
                          ? (roleName.get(s.role_id) ?? "Archived role")
                          : s.membership_id
                            ? (personName.get(s.membership_id) ??
                              "Person who can no longer approve")
                            : "Category approvers"}
                        {" · "}
                        {s.required_approvals} needed
                        {s.min_amount_minor !== null &&
                          ` · From ${formatMoney(s.min_amount_minor, details.currency)}`}
                      </span>
                    </li>
                  ))}
                </ol>
              ),
            }))}
          />
          <Card className="p-6">
            <h2 className="mb-3 text-sm font-semibold">Archive</h2>
            <ArchiveWorkflow orgId={id} slug={orgSlug} id={workflow.id} />
          </Card>
        </div>
      )}
    </>
  );
}
