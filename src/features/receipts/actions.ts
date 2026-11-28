"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deliverSoon } from "@/features/notifications/deliver";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";

const refresh = () => revalidatePath("/o/[orgSlug]", "layout");

export async function issueReceipt(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      lineId: z.uuid(),
      lock: z.coerce.number().int(),
      description: z.string().trim().max(200, "Keep it under 200 characters."),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("issue_internal_receipt", {
    p_line: input.data.lineId,
    p_lock: input.data.lock,
    p_description: input.data.description,
  });
  if (error) return failure(error);
  deliverSoon();
  refresh();
  return { ok: true, message: "Receipt issued." };
}

export async function voidReceipt(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      id: z.uuid(),
      reason: z.string().trim().min(5, "Give a reason of at least 5 characters.").max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("void_internal_receipt", { p_id: input.data.id, p_reason: input.data.reason });
  if (error) return failure(error);
  deliverSoon();
  refresh();
  return { ok: true, message: "Receipt voided. You can issue a new one." };
}
