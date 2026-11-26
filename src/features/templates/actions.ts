"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { redirectWith } from "@/lib/flash";
import { optionalId } from "@/lib/forms";
import { parseSaved, readJson } from "@/lib/rpc-json";
import { createClient } from "@/lib/supabase/server";
import { templateFields, templateKind } from "./schema";

const base = z.object({ orgId: z.uuid(), slug: z.string().regex(/^[a-z0-9-]+$/) });

export async function saveTemplate(_: ActionState, form: FormData): Promise<ActionState> {
  const input = base
    .extend({
      id: optionalId,
      kind: templateKind,
      name: z.string().trim().min(2, "Enter at least 2 characters.").max(80),
      expected: z.coerce.number().int().min(0),
      fields: templateFields,
    })
    .safeParse({ ...Object.fromEntries(form), fields: readJson(form.get("fields")) });
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { data, error } = await (
    await createClient()
  ).rpc("save_template", {
    p_org: v.orgId,
    p_id: v.id as string,
    p_kind: v.kind,
    p_name: v.name,
    p_fields: v.fields,
    p_expected: v.expected,
  });
  if (error) return failure(error);
  revalidatePath("/o/[orgSlug]", "layout");
  const saved = parseSaved(data);
  if (!v.id)
    return redirectWith(`/o/${v.slug}/configuration/templates/${saved.id}`, "Template created.");
  return {
    ok: true,
    message:
      saved.version === v.expected ? "Template saved." : `Version ${saved.version} published.`,
    data: { version: String(saved.version) },
  };
}

export async function archiveTemplate(_: ActionState, form: FormData): Promise<ActionState> {
  const input = base.extend({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("archive_template", { p_org: input.data.orgId, p_id: input.data.id });
  if (error) return failure(error);
  revalidatePath("/o/[orgSlug]", "layout");
  return redirectWith(`/o/${input.data.slug}/configuration/templates`, "Template archived.");
}
