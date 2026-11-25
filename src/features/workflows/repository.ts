import "server-only";
import { isId } from "@/lib/server-page";
import { createClient } from "@/lib/supabase/server";
import { workflowStep, workflowSubject, type WorkflowSubject } from "./schema";

export async function listWorkflows(orgId: string, subject?: WorkflowSubject) {
  let request = (await createClient())
    .from("workflows")
    .select("id, subject, name, current_version_id")
    .eq("org_id", orgId)
    .is("archived_at", null)
    .order("name");
  if (subject) request = request.eq("subject", subject);
  const { data, error } = await request;
  if (error) throw new Error("Could not load workflows");
  return data;
}

async function loadSteps(orgId: string, versionIds: string[]) {
  const { data, error } = await (
    await createClient()
  )
    .from("workflow_steps")
    .select(
      "workflow_version_id, position, name, approver_type, role_id, membership_id, min_amount_minor, required_approvals",
    )
    .eq("org_id", orgId)
    .in("workflow_version_id", versionIds)
    .order("position");
  if (error) throw new Error("Could not load workflow steps");
  return data.map(({ workflow_version_id, position, ...step }) => ({
    versionId: workflow_version_id,
    position,
    step: workflowStep.parse(step),
  }));
}

export async function listWorkflowDetails(orgId: string) {
  const workflows = await listWorkflows(orgId);
  const ids = workflows.flatMap((w) => w.current_version_id ?? []);
  const [versions, steps] = await Promise.all([
    (await createClient())
      .from("workflow_versions")
      .select("id, version, published_at")
      .eq("org_id", orgId)
      .in("id", ids),
    loadSteps(orgId, ids),
  ]);
  if (versions.error) throw new Error("Could not load workflows");
  return workflows.map((w) => {
    const version = versions.data.find((v) => v.id === w.current_version_id);
    return {
      id: w.id,
      name: w.name,
      subject: workflowSubject.parse(w.subject),
      version: version?.version ?? 0,
      publishedAt: version?.published_at ?? "",
      steps: steps.filter((s) => s.versionId === w.current_version_id).map((s) => s.step.name),
    };
  });
}

export async function getWorkflow(orgId: string, id: string) {
  if (!isId(id)) return null;
  const supabase = await createClient();
  const { data: workflow, error } = await supabase
    .from("workflows")
    .select("id, subject, name, current_version_id")
    .eq("org_id", orgId)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error("Could not load workflow");
  if (!workflow) return null;
  const versions = await supabase
    .from("workflow_versions")
    .select("id, version, published_at")
    .eq("org_id", orgId)
    .eq("workflow_id", id)
    .order("version", { ascending: false })
    .limit(50);
  if (versions.error) throw new Error("Could not load workflow");
  const steps = await loadSteps(
    orgId,
    versions.data.map((v) => v.id),
  );
  const history = versions.data.map((v) => ({
    id: v.id,
    version: v.version,
    publishedAt: v.published_at,
    steps: steps.filter((s) => s.versionId === v.id).map((s) => s.step),
  }));
  const current = history.find((v) => v.id === workflow.current_version_id);
  if (!current) throw new Error("Workflow has no published version");
  return {
    id: workflow.id,
    name: workflow.name,
    subject: workflowSubject.parse(workflow.subject),
    version: current.version,
    steps: current.steps,
    history,
  };
}

/** People whose roles let them approve this kind of item. */
export async function listApprovers(
  orgId: string,
  permission: "requests.approve" | "reports.review",
) {
  const { data, error } = await (
    await createClient()
  ).rpc("list_approvers", { p_org: orgId, p_key: permission });
  if (error) throw new Error("Could not load approvers");
  return data;
}
