"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  orgId: z.uuid(),
  type: z.enum(["request", "report", "payment", "internal_receipt"]),
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, "Use 2–8 letters or numbers."),
  reset: z.enum(["year", "month", "never"]),
  digits: z.coerce.number("Choose 3 to 8.").int().min(3, "Choose 3 to 8.").max(8, "Choose 3 to 8."),
});

export async function saveNumbering(_: ActionState, form: FormData): Promise<ActionState> {
  const input = schema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { error } = await (
    await createClient()
  ).rpc("save_numbering", {
    p_org: v.orgId,
    p_type: v.type,
    p_prefix: v.prefix,
    p_reset: v.reset,
    p_digits: v.digits,
  });
  if (error) return failure(error);
  revalidatePath("/o/[orgSlug]", "layout");
  return { ok: true, message: "Numbering saved." };
}
