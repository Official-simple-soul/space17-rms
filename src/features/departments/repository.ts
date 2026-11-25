import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listDepartments(orgId: string) {
  const { data, error } = await (
    await createClient()
  )
    .from("departments")
    .select("id, name, code, parent_id")
    .eq("org_id", orgId)
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error("Could not load departments");
  return data;
}
export type Department = Awaited<ReturnType<typeof listDepartments>>[number];

export async function getDepartmentOverview(orgId: string) {
  const { data, error } = await (await createClient()).rpc("department_overview", { p_org: orgId });
  if (error) throw new Error("Could not load departments");
  return new Map(data.map((d) => [d.department_id, d]));
}
