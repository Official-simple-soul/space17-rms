import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listAudit(orgId: string, limit = 50) {
  const { data, error } = await (
    await createClient()
  )
    .from("audit_logs")
    .select("id, action, entity_type, reason, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load audit log");
  return data;
}
