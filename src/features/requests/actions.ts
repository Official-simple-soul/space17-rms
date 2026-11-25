"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deliverSoon } from "@/features/notifications/deliver";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { createUploadUrl, deleteFiles, inspectFile } from "@/lib/files/storage";
import { FILE_TYPES, isFileType, MAX_FILE_SIZE } from "@/lib/files/types";
import { optionalId } from "@/lib/forms";
import { parseSaved, readJson } from "@/lib/rpc-json";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { previewSteps } from "./repository";
import { draftSchema, type Draft } from "./schema";

const slug = z.string().regex(/^[a-z0-9-]+$/);
const lock = z.coerce.number().int();
const reason = z.string().trim().min(5, "Give a reason of at least 5 characters.").max(1000);
const refresh = () => revalidatePath("/o/[orgSlug]", "layout");

export async function startRequest(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      orgId: z.uuid(),
      slug,
      categoryId: z.uuid("Choose a category."),
      departmentId: optionalId,
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { data, error } = await (
    await createClient()
  ).rpc("save_request", {
    p_org: v.orgId,
    p_id: null as unknown as string,
    p_category: v.categoryId,
    p_department: v.departmentId as string,
    p_title: "",
    p_purpose: "",
    p_needed_by: null as unknown as string,
    p_form: {},
    p_items: [],
    p_lock: null as unknown as number,
  });
  if (error) return failure(error);
  redirect(`/o/${v.slug}/requests/${parseSaved(data).id}/edit`);
}

type SaveResult =
  | { ok: true; version: number; steps: { name: string; who: string; required: number }[] }
  | { ok: false; message: string; stale: boolean };

export async function saveDraft(input: Draft): Promise<SaveResult> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Something here can't be saved. Check long text and amounts.",
      stale: false,
    };
  const v = parsed.data;
  const { data, error } = await (
    await createClient()
  ).rpc("save_request", {
    p_org: v.orgId,
    p_id: v.id,
    p_category: v.categoryId,
    p_department: v.departmentId as string,
    p_title: v.title,
    p_purpose: v.purpose,
    p_needed_by: v.neededBy as string,
    p_form: v.form,
    p_items: v.items,
    p_lock: v.lock,
  });
  if (error)
    return {
      ok: false,
      message: failure(error).message!,
      stale: ["stale_request", "request_locked", "not_found"].includes(error.message),
    };
  const total = v.items.reduce((sum, i) => sum + Math.round(i.quantity * i.unit_price_minor), 0);
  return {
    ok: true,
    version: parseSaved(data).version,
    steps: await previewSteps(v.categoryId, total),
  };
}

export async function submitRequest(
  id: string,
  version: number,
): Promise<{ ok: boolean; message?: string; templateChanged?: boolean }> {
  if (!z.uuid().safeParse(id).success || !Number.isInteger(version))
    return { ok: false, message: "Something went wrong. Please try again." };
  const { error } = await (
    await createClient()
  ).rpc("submit_request", { p_id: id, p_lock: version });
  if (error)
    return {
      ok: false,
      message: failure(error).message,
      templateChanged: error.message === "template_changed",
    };
  deliverSoon();
  refresh();
  return { ok: true };
}

const target = z.object({ slug, id: z.uuid() });

export async function deleteDraft(_: ActionState, form: FormData): Promise<ActionState> {
  const input = target.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { data, error } = await (await createClient()).rpc("delete_draft", { p_id: input.data.id });
  if (error) return failure(error);
  await deleteFiles(data);
  refresh();
  redirect(`/o/${input.data.slug}/requests`);
}

export async function withdrawRequest(_: ActionState, form: FormData): Promise<ActionState> {
  const input = target.extend({ lock, reason }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("withdraw_request", {
    p_id: input.data.id,
    p_lock: input.data.lock,
    p_reason: input.data.reason,
  });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: "Request withdrawn." };
}

export async function decideRequest(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      stepId: z.uuid(),
      lock,
      decision: z.enum(["approve", "return", "reject"]),
      comment: z.string().trim().max(1000),
      items: z.array(
        z.object({ id: z.uuid(), approved_minor: z.number("Check the amounts.").int().min(0) }),
      ),
    })
    .refine((v) => v.decision === "approve" || v.comment.length >= 5, {
      path: ["comment"],
      message: "Give a reason of at least 5 characters.",
    })
    .refine((v) => !v.items.length || v.comment.length >= 5, {
      path: ["comment"],
      message: "Say why you reduced the amount.",
    })
    .safeParse({ ...Object.fromEntries(form), items: readJson(form.get("items")) });
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { error } = await (
    await createClient()
  ).rpc("decide_request", {
    p_step: v.stepId,
    p_lock: v.lock,
    p_action: v.decision,
    p_comment: v.comment,
    p_items: v.items,
  });
  // Also refresh on failure, to show what changed when someone else acted first.
  refresh();
  if (error) return failure(error);
  deliverSoon();
  return {
    ok: true,
    message: { approve: "Approved.", return: "Returned to the requester.", reject: "Rejected." }[
      v.decision
    ],
  };
}

export async function reassignStep(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({ stepId: z.uuid(), memberId: z.uuid("Choose a person."), reason })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("reassign_step", {
    p_step: input.data.stepId,
    p_membership: input.data.memberId,
    p_reason: input.data.reason,
  });
  if (error) return failure(error);
  deliverSoon();
  refresh();
  return { ok: true, message: "Approval reassigned." };
}

export async function addComment(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({ id: z.uuid(), body: z.string().trim().min(1, "Write a comment.").max(2000) })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("comment_on_request", { p_id: input.data.id, p_body: input.data.body });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

// Files ---------------------------------------------------------------------

const fileInput = z.object({
  requestId: z.uuid(),
  field: z.string().max(40).nullable(),
  name: z.string().trim().min(1).max(255),
  type: z.string().refine(isFileType),
  size: z.number().int().min(1).max(MAX_FILE_SIZE),
});

export async function startUpload(
  input: z.input<typeof fileInput>,
): Promise<{ ok: true; id: string; url: string } | { ok: false; message: string }> {
  const parsed = fileInput.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: `Use ${[...new Set(Object.values(FILE_TYPES))].join(", ")} files up to 10 MB.`,
    };
  const v = parsed.data;
  const { data, error } = await (
    await createClient()
  ).rpc("start_attachment", {
    p_request: v.requestId,
    p_field: v.field as string,
    p_name: v.name,
    p_mime: v.type,
    p_size: v.size,
  });
  if (error) return { ok: false, message: failure(error).message! };
  const { id, path } = z.object({ id: z.uuid(), path: z.string() }).parse(data);
  return { ok: true, id, url: await createUploadUrl(path) };
}

export async function finishUpload(
  id: string,
): Promise<{ ok: true; size: number } | { ok: false; message: string }> {
  const failed = { ok: false as const, message: "That file couldn't be read. Try another." };
  if (!z.uuid().safeParse(id).success) return failed;
  // The caller's session proves the upload is theirs before the server touches storage.
  const { data: pending } = await (
    await createClient()
  )
    .rpc("get_pending_attachment", { p_id: id })
    .maybeSingle();
  if (!pending) return failed;
  const file = await inspectFile(pending.storage_path, pending.mime);
  const admin = createAdminClient();
  const { error } = file
    ? await admin.rpc("finish_attachment", {
        p_id: id,
        p_size: file.size,
        p_sha256: file.sha256,
      })
    : { error: null };
  if (file && !error) return { ok: true, size: file.size };
  await deleteFiles([pending.storage_path]);
  await admin.rpc("discard_attachment", { p_id: id });
  return error ? { ok: false, message: failure(error).message! } : failed;
}

export async function removeUpload(id: string): Promise<{ ok: boolean; message?: string }> {
  if (!z.uuid().safeParse(id).success) return { ok: false };
  const { data, error } = await (await createClient()).rpc("remove_attachment", { p_id: id });
  if (error) return { ok: false, message: failure(error).message };
  if (data) await deleteFiles([data]);
  return { ok: true };
}
