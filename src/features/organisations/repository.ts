import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { token as tokenSchema } from "./schema";

export async function findInvite(token: string) {
  if (!tokenSchema.safeParse(token).success) return null;
  const { data, error } = await createAdminClient()
    .rpc("peek_org_invite", { p_token: token })
    .maybeSingle();
  if (error) throw new Error("Could not read invitation");
  return data;
}

export async function getOrganisation(id: string) {
  const { data, error } = await (
    await createClient()
  )
    .from("organisations")
    .select("id, name, slug, currency, timezone, fiscal_year_start_month, status")
    .eq("id", id)
    .single();
  if (error) throw new Error("Could not load organisation");
  return data;
}

export async function getSetupCounts(orgId: string) {
  const supabase = await createClient();
  const count = async (table: "memberships" | "departments" | "roles") =>
    (await supabase.from(table).select("id", { count: "exact", head: true }).eq("org_id", orgId))
      .count ?? 0;
  const [members, departments, roles] = await Promise.all([
    count("memberships"),
    count("departments"),
    count("roles"),
  ]);
  return { members, departments, roles };
}
