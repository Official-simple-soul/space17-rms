"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deliverSoon } from "@/features/notifications/deliver";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";

export async function saveBankAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      orgId: z.uuid(),
      bank: z.string().trim().min(2, "Enter the bank's name.").max(80),
      name: z.string().trim().min(2, "Enter the name on the account.").max(120),
      number: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9\s-]{6,40}$/, "Enter the account number."),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { error } = await (
    await createClient()
  ).rpc("save_bank_account", {
    p_org: v.orgId,
    p_bank: v.bank,
    p_name: v.name,
    p_number: v.number,
  });
  if (error) return failure(error);
  deliverSoon();
  revalidatePath("/o/[orgSlug]", "layout");
  return { ok: true, message: "Bank details saved." };
}

export async function removeBankAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ orgId: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("remove_bank_account", { p_org: input.data.orgId });
  if (error) return failure(error);
  deliverSoon();
  revalidatePath("/o/[orgSlug]", "layout");
  return { ok: true, message: "Bank details removed." };
}
