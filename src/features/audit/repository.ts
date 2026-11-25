import "server-only";
import { createClient } from "@/lib/supabase/server";

export const AUDIT_LIMIT = 500;
const readable = (value: string) => {
  const text = value.replace(/[._]/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export async function listAudit(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, reason, created_at, actor_user_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(AUDIT_LIMIT);
  if (error) throw new Error("Could not load audit log");
  const ids = [...new Set(data.flatMap((e) => e.actor_user_id ?? []))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", ids);
  const names = new Map(profiles?.map((p) => [p.user_id, p.full_name]));
  return data.map((e) => ({
    id: e.id,
    action: readable(e.action),
    area: readable(e.entity_type),
    // Platform staff aren't members, so their profiles aren't visible here.
    person: e.actor_user_id ? names.get(e.actor_user_id) || "Platform or former user" : "System",
    reason: e.reason ?? "",
    at: e.created_at,
  }));
}
