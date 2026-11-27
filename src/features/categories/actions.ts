"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";
import { categorySchema } from "./schema";

export async function saveCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const input = categorySchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { error } = await (
    await createClient()
  ).rpc("save_category", { p_org: v.orgId, p_id: v.id as string, p_name: v.name });
  if (error) return failure(error);
  revalidatePath("/o/[orgSlug]", "layout");
  return { ok: true, message: v.id ? "Category saved." : `${v.name} added.` };
}

export async function archiveCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ orgId: z.uuid(), id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("archive_category", { p_org: input.data.orgId, p_id: input.data.id });
  if (error) return failure(error);
  revalidatePath("/o/[orgSlug]", "layout");
  return { ok: true, message: "Category archived." };
}
