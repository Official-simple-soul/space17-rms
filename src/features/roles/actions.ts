"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { optionalId } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const base = z.object({ orgId: z.uuid(), slug: z.string().regex(/^[a-z0-9-]+$/) });

export async function saveRole(_: ActionState, form: FormData): Promise<ActionState> {
  const input = base
    .extend({
      id: optionalId,
      name: z.string().trim().min(2, "Enter at least 2 characters.").max(60),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const permissions = [...form.entries()]
    .filter(([name, value]) => name.startsWith("perm:") && value)
    .map(([name, scope]) => ({ key: name.slice(5), scope: String(scope) }));
  const { data, error } = await (
    await createClient()
  ).rpc("save_role", {
    p_org: input.data.orgId,
    p_id: input.data.id as string,
    p_name: input.data.name,
    p_permissions: permissions,
  });
  if (error) return failure(error);
  revalidatePath("/o/[orgSlug]", "layout");
  if (!input.data.id) redirect(`/o/${input.data.slug}/roles/${data}`);
  return { ok: true, message: "Role saved." };
}

export async function archiveRole(_: ActionState, form: FormData): Promise<ActionState> {
  const input = base.extend({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("archive_role", {
    p_org: input.data.orgId,
    p_id: input.data.id,
  });
  if (error) return failure(error);
  revalidatePath("/o/[orgSlug]", "layout");
  redirect(`/o/${input.data.slug}/roles`);
}
