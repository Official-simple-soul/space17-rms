import "server-only";
import { z } from "zod";
import { parseSort } from "@/lib/data-view";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;
const isId = (value: unknown): value is string => z.uuid().safeParse(value).success;
const text = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

type Query = Record<string, string | string[] | undefined>;

/** One page of everyone in the organisation. Departments group people; they never hide them. */
export async function listMembers(orgId: string, query: Query) {
  const supabase = await createClient();
  const sort = parseSort(text(query.sort));
  const department = text(query.department);
  const role = text(query.role);
  const status = text(query.status);
  const load = async (page: number) => {
    const { data, error } = await supabase.rpc("list_members", {
      p_org: orgId,
      p_search: text(query.q),
      p_department: isId(department) ? department : undefined,
      p_no_department: department === "none",
      p_role: isId(role) ? role : undefined,
      p_status: ["active", "suspended"].includes(status) ? status : undefined,
      p_sort: sort?.key,
      p_desc: sort?.desc,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    });
    if (error) throw new Error("Could not load people");
    return data;
  };
  let page = Math.min(Math.max(1, Number.parseInt(text(query.page), 10) || 1), 100_000);
  let data = await load(page);
  if (!data.length && page > 1) {
    page = 1;
    data = await load(page);
  }
  return {
    page,
    pageSize: PAGE_SIZE,
    total: data[0]?.total ?? 0,
    rows: data.map(({ id, name, status, roles, department_names }) => ({
      id,
      name,
      status,
      roles,
      departments: department_names,
    })),
  };
}

export async function countMembers(orgId: string) {
  const { count, error } = await (
    await createClient()
  )
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .neq("status", "left");
  if (error) throw new Error("Could not count people");
  return count ?? 0;
}

export async function getMember(orgId: string, id: string) {
  if (!isId(id)) return null;
  const supabase = await createClient();
  const { data: member, error } = await supabase
    .from("memberships")
    .select("id, user_id, status, primary_department_id")
    .eq("org_id", orgId)
    .eq("id", id)
    .neq("status", "left")
    .maybeSingle();
  if (error) throw new Error("Could not load person");
  if (!member) return null;
  const [profile, grants, links] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("user_id", member.user_id).maybeSingle(),
    supabase
      .from("membership_roles")
      .select("id, role_id, department_id, valid_until")
      .eq("membership_id", id),
    supabase.from("department_members").select("department_id").eq("membership_id", id),
  ]);
  if (profile.error || grants.error || links.error) throw new Error("Could not load person");
  const now = Date.now();
  return {
    id: member.id,
    userId: member.user_id,
    status: member.status,
    primaryDepartmentId: member.primary_department_id,
    name: profile.data?.full_name || "Unnamed member",
    departmentIds: links.data.map((l) => l.department_id),
    grants: grants.data.filter((g) => !g.valid_until || new Date(g.valid_until).getTime() > now),
  };
}

export async function listInvitations(orgId: string) {
  const { data, error } = await (
    await createClient()
  )
    .from("invitations")
    .select("id, email, role_id, expires_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load invitations");
  return data;
}

export async function findInvitation(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { data, error } = await createAdminClient()
    .rpc("peek_invitation", { p_token: token })
    .maybeSingle();
  if (error) throw new Error("Could not read invitation");
  return data;
}
