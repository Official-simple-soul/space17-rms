import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listRoles(orgId: string) {
  const supabase = await createClient();
  const [roles, permissions] = await Promise.all([
    supabase
      .from("roles")
      .select("id, name, system_key")
      .eq("org_id", orgId)
      .is("archived_at", null)
      .order("created_at")
      .order("name"),
    supabase.from("role_permissions").select("role_id, permission_key, scope").eq("org_id", orgId),
  ]);
  if (roles.error || permissions.error) throw new Error("Could not load roles");
  return roles.data.map((r) => {
    const own = permissions.data.filter((p) => p.role_id === r.id);
    return {
      id: r.id,
      name: r.name,
      systemKey: r.system_key,
      permissions: own.map((p) => ({ key: p.permission_key, scope: p.scope })),
      needsDepartment: own.some((p) => p.scope === "department"),
    };
  });
}
export type Role = Awaited<ReturnType<typeof listRoles>>[number];

export async function listPermissions() {
  const { data, error } = await (
    await createClient()
  )
    .from("permissions")
    .select("key, description, allowed_scopes")
    .order("key");
  if (error) throw new Error("Could not load permissions");
  return data;
}

export async function getRoleCounts(orgId: string) {
  const { data, error } = await (await createClient()).rpc("role_overview", { p_org: orgId });
  if (error) throw new Error("Could not load roles");
  return new Map(data.map((r) => [r.role_id, r.people]));
}
