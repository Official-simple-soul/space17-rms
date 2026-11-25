"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";

async function markRead(orgId: string, requestId?: string) {
  const { error } = await (
    await createClient()
  ).rpc("mark_notifications_read", { p_org: orgId, p_request: requestId });
  if (!error) revalidatePath("/o/[orgSlug]", "layout");
  return error;
}

export async function markAllRead(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ orgId: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const error = await markRead(input.data.orgId);
  return error ? failure(error) : { ok: true };
}

export async function markRequestRead(orgId: string, requestId: string): Promise<void> {
  if ([orgId, requestId].every((id) => z.uuid().safeParse(id).success))
    await markRead(orgId, requestId);
}
