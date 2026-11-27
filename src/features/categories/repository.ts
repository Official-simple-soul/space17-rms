import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listCategories(orgId: string) {
  const { data, error } = await (
    await createClient()
  )
    .from("categories")
    .select("id, name")
    .eq("org_id", orgId)
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error("Could not load categories");
  return data;
}
export type Category = Awaited<ReturnType<typeof listCategories>>[number];
