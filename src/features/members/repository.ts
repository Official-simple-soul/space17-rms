import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listMembers(orgId: string) {
  const supabase = await createClient();
  const [members, grants, roles] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, user_id, status")
      .eq("org_id", orgId)
      .order("created_at"),
    supabase.from("membership_roles").select("membership_id, role_id").eq("org_id", orgId),
    supabase.from("roles").select("id, name").eq("org_id", orgId),
  ]);
  if (members.error || grants.error || roles.error) throw new Error("Could not load people");
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in(
      "user_id",
      members.data.map((m) => m.user_id),
    );
  if (error) throw new Error("Could not load profiles");
  const names = new Map(profiles.map((p) => [p.user_id, p.full_name]));
  const roleNames = new Map(roles.data.map((r) => [r.id, r.name]));
  return members.data.map((m) => ({
    id: m.id,
    status: m.status,
    name: names.get(m.user_id) || "Unnamed member",
    roles: grants.data
      .filter((g) => g.membership_id === m.id)
      .map((g) => roleNames.get(g.role_id) ?? ""),
  }));
}
