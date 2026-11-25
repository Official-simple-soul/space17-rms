"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: z
    .string()
    .trim()
    .max(32)
    .transform((v) => v || null),
});

export async function updateProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const input = schema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const session = await requireSession();
  const { error } = await (
    await createClient()
  )
    .from("profiles")
    .update({ full_name: input.data.fullName, phone: input.data.phone })
    .eq("user_id", session.userId);
  if (error) return failure(error);
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}
