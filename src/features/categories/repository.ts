import "server-only";
import { isId } from "@/lib/server-page";
import { createClient } from "@/lib/supabase/server";
import { appliesTo } from "./schema";

const COLUMNS =
  "id, name, code, applies_to, requires_accounting, template_id, workflow_id, category_departments(department_id), category_approvers(membership_id, role_id, department_id)";

export async function listCategories(orgId: string) {
  const { data, error } = await (
    await createClient()
  )
    .from("categories")
    .select(COLUMNS)
    .eq("org_id", orgId)
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error("Could not load categories");
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    appliesTo: appliesTo.parse(c.applies_to),
    requiresAccounting: c.requires_accounting,
    templateId: c.template_id,
    workflowId: c.workflow_id,
    departmentIds: c.category_departments.map((d) => d.department_id),
    approvers: c.category_approvers,
  }));
}
export type Category = Awaited<ReturnType<typeof listCategories>>[number];

export async function getCategory(orgId: string, id: string) {
  if (!isId(id)) return null;
  return (await listCategories(orgId)).find((c) => c.id === id) ?? null;
}
