import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function tourNeeded(orgId: string) {
  const { data, error } = await (await createClient()).rpc("tour_needed", { p_org: orgId });
  return !error && data === true;
}
