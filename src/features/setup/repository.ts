import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getSetupCounts(orgId: string) {
  const { data, error } = await (
    await createClient()
  )
    .rpc("setup_counts", { p_org: orgId })
    .single();
  if (error) throw new Error("Could not load setup");
  return data;
}

export async function listSetupWarnings(orgId: string) {
  const { data, error } = await (await createClient()).rpc("setup_warnings", { p_org: orgId });
  if (error) throw new Error("Could not load setup checks");
  return data;
}
export type SetupWarning = Awaited<ReturnType<typeof listSetupWarnings>>[number];
