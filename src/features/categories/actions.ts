"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { redirectWith } from "@/lib/flash";
import { readJson } from "@/lib/rpc-json";
import { createClient } from "@/lib/supabase/server";
import { categorySchema } from "./schema";

export async function saveCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const input = categorySchema.safeParse({
    ...Object.fromEntries(form),
    requiresAccounting: form.get("requiresAccounting") === "on",
    departments: form.getAll("departments"),
    approvers: readJson(form.get("approvers")),
  });
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { error } = await (
    await createClient()
  ).rpc("save_category", {
    p_org: v.orgId,
    p_id: v.id as string,
    p_name: v.name,
    p_code: v.code,
    p_applies_to: v.appliesTo,
    p_requires_accounting: v.requiresAccounting,
    p_template: v.templateId as string,
    p_workflow: v.workflowId as string,
    p_departments: v.departments,
    p_approvers: v.approvers,
  });
  if (error) return failure(error);
  revalidatePath("/o/[orgSlug]", "layout");
  if (!v.id) return redirectWith(`/o/${v.slug}/configuration/categories`, "Category added.");
  return { ok: true, message: "Category saved." };
}

export async function archiveCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({ orgId: z.uuid(), slug: z.string().regex(/^[a-z0-9-]+$/), id: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("archive_category", { p_org: input.data.orgId, p_id: input.data.id });
  if (error) return failure(error);
  revalidatePath("/o/[orgSlug]", "layout");
  return redirectWith(`/o/${input.data.slug}/configuration/categories`, "Category archived.");
}
