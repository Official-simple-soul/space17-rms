import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getMyBankAccount(orgId: string) {
  const { data, error } = await (
    await createClient()
  )
    .rpc("my_bank_account", { p_org: orgId })
    .maybeSingle();
  if (error) throw new Error("Could not load bank details");
  return data;
}
