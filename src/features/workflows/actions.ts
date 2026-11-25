"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { optionalId } from "@/lib/forms";
import { parseSaved, readJson } from "@/lib/rpc-json";
import { createClient } from "@/lib/supabase/server";
import { workflowSteps, workflowSubject } from "./schema";

const base = z.object({ orgId: z.uuid(), slug: z.string().regex(/^[a-z0-9-]+$/) });

export async function saveWorkflow(_: ActionState, form: FormData): Promise<ActionState> {
  const input = base
    .extend({
      id: optionalId,
      subject: workflowSubject,
      name: z.string().trim().min(2, "Enter at least 2 characters.").max(80),
      expected: z.coerce.number().int().min(0),
      steps: workflowSteps,
    })
    .safeParse({ ...Object.fromEntries(form), steps: readJson(form.get("steps")) });
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { data, error } = await (
    await createClient()
  ).rpc("save_workflow", {
    p_org: v.orgId,
    p_id: v.id as string,
    p_subject: v.subject,
    p_name: v.name,
    p_steps: v.steps,
    p_expected: v.expected,
  });
  if (error) return failure(error);
  revalidatePath("/o/[orgSlug]", "layout");
  const saved = parseSaved(data);
  if (!v.id) redirect(`/o/${v.slug}/configuration/workflows/${saved.id}`);
  return {
    ok: true,
    message:
      saved.version === v.expected ? "Workflow saved." : `Version ${saved.version} published.`,
    data: { version: String(saved.version) },
  };
}

export async function archiveWorkflow(_: ActionState, form: FormData): Promise<ActionState> {
  const input = base.extend({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("archive_workflow", { p_org: input.data.orgId, p_id: input.data.id });
  if (error) return failure(error);
  revalidatePath("/o/[orgSlug]", "layout");
  redirect(`/o/${input.data.slug}/configuration/workflows`);
}
