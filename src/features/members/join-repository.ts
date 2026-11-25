import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getJoinSetup(orgId: string) {
  const supabase = await createClient();
  const [code, requests] = await Promise.all([
    supabase.rpc("get_join_code", { p_org: orgId }),
    supabase.rpc("list_join_requests", { p_org: orgId }),
  ]);
  if (code.error || requests.error) throw new Error("Could not load join requests");
  return {
    code: (code.data as string | null) ?? "",
    requests: requests.data.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.full_name,
      at: r.created_at,
    })),
  };
}
