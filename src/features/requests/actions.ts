"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { messageInput } from "@/features/conversations/schema";
import { badFile, uploadInput, type UploadStart } from "@/features/files/schema";
import { uploadLink } from "@/features/files/start";
import { deliverSoon } from "@/features/notifications/deliver";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { redirectWith } from "@/lib/flash";
import { deleteFiles } from "@/lib/files/storage";
import { parseSaved, readJson } from "@/lib/rpc-json";
import { createClient } from "@/lib/supabase/server";
import { draftSchema, type Draft } from "./schema";

const slug = z.string().regex(/^[a-z0-9-]+$/);
const lock = z.coerce.number().int();
const reason = z.string().trim().min(5, "Give a reason of at least 5 characters.").max(1000);
const refresh = () => revalidatePath("/o/[orgSlug]", "layout");

type SaveResult =
  { ok: true; id: string; version: number } | { ok: false; message: string; stale: boolean };

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
    p_id: v.id as string,
    p_department: v.departmentId as string,
    p_category: v.categoryId as string,
    p_title: v.title,
    p_purpose: v.purpose,
    p_needed_by: v.neededBy as string,
    p_supplier: v.supplier,
    p_provision: v.provision as string,
    p_items: v.items,
    p_lock: v.lock as number,
  });
  if (error)
    return {
      ok: false,
      message: failure(error).message!,
      stale: ["stale_request", "request_locked", "not_found"].includes(error.message),
    };
  return { ok: true, ...parseSaved(data) };
}

export async function submitRequest(
  id: string,
  version: number,
): Promise<{ ok: boolean; message?: string }> {
  if (!z.uuid().safeParse(id).success || !Number.isInteger(version))
    return { ok: false, message: "Something went wrong. Please try again." };
  const { error } = await (
    await createClient()
  ).rpc("submit_request", { p_id: id, p_lock: version });
  if (error) return { ok: false, message: failure(error).message };
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
  return redirectWith(`/o/${input.data.slug}/requests`, "Draft deleted.");
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

export async function sendRequestMessage(_: ActionState, form: FormData): Promise<ActionState> {
  const input = messageInput.extend({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const question = input.data.question === "on";
  const { error } = await (
    await createClient()
  ).rpc("send_request_message", {
    p_id: input.data.id,
    p_body: input.data.body,
    p_question: question,
  });
  if (error) return failure(error);
  deliverSoon();
  refresh();
  return { ok: true, message: question ? "Question sent." : "Message sent." };
}

const fileInput = uploadInput.extend({
  requestId: z.uuid(),
  field: z.string().max(40).nullable(),
});

export async function startUpload(input: z.input<typeof fileInput>): Promise<UploadStart> {
  const parsed = fileInput.safeParse(input);
  if (!parsed.success) return badFile;
  const v = parsed.data;
  return uploadLink(
    await (
      await createClient()
    ).rpc("start_attachment", {
      p_request: v.requestId,
      p_field: v.field as string,
      p_name: v.name,
      p_mime: v.type,
      p_size: v.size,
    }),
  );
}

export async function handOverItem(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({ id: z.uuid(), lock, note: z.string().trim().max(500) })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("hand_over_item", {
    p_id: input.data.id,
    p_lock: input.data.lock,
    p_note: input.data.note,
  });
  if (error) return failure(error);
  deliverSoon();
  refresh();
  return { ok: true, message: "Marked as handed over." };
}

export async function confirmItem(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ id: z.uuid(), lock }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("confirm_item", { p_id: input.data.id, p_lock: input.data.lock });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: "Thanks. It's marked as received." };
}
