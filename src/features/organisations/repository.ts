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
    .select("id, name, slug, currency, timezone, fiscal_year_start_month, report_due_day, status")
    .eq("id", id)
    .single();
  if (error) throw new Error("Could not load organisation");
  return data;
}
