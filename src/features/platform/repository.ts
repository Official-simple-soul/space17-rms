import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getPlatformOverview() {
  const supabase = await createClient();
  const [organisations, invites, requests, sessions] = await Promise.all([
    supabase
      .from("organisations")
      .select("id, name, slug, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("org_invites")
      .select("id, email, expires_at")
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("access_requests")
      .select("id, org_name, contact_name, email, message, created_at")
      .eq("status", "pending")
      .order("created_at")
      .limit(100),
    supabase
      .from("support_sessions")
      .select("id, org_id, expires_at")
      .is("ended_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);
  if (organisations.error || invites.error || requests.error || sessions.error)
    throw new Error("Could not load platform data");
  return {
    organisations: organisations.data,
    invites: invites.data,
    requests: requests.data,
    sessions: sessions.data,
  };
}
