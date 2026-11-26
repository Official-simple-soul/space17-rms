"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { optionalId } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  orgId: z.uuid(),
  id: optionalId,
  parentId: optionalId,
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, "Use 2–10 letters or numbers."),
});

export async function saveDepartment(_: ActionState, form: FormData): Promise<ActionState> {
  const input = schema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { error } = await (
    await createClient()
  ).rpc("save_department", {
    p_org: v.orgId,
    p_id: v.id as string,
    p_name: v.name,
    p_code: v.code,
    p_parent: v.parentId as string,
  });
  if (error) return failure(error);
  revalidatePath("/o/[orgSlug]", "layout");
  return { ok: true, message: v.id ? "Department saved." : `${v.name} added.` };
}

export async function archiveDepartment(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ orgId: z.uuid(), id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("archive_department", {
    p_org: input.data.orgId,
    p_id: input.data.id,
  });
  if (error) return failure(error);
  revalidatePath("/o/[orgSlug]", "layout");
  return { ok: true, message: "Department archived." };
}
