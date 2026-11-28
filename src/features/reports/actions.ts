"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { messageInput } from "@/features/conversations/schema";
import { badFile, uploadInput, type UploadStart } from "@/features/files/schema";
import { uploadLink } from "@/features/files/start";
import { deliverSoon } from "@/features/notifications/deliver";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { parseSaved } from "@/lib/rpc-json";
import { createClient } from "@/lib/supabase/server";
import { draftSchema, type Draft } from "./schema";

const refresh = () => revalidatePath("/o/[orgSlug]", "layout");

type SaveResult = { ok: true; version: number } | { ok: false; message: string; stale: boolean };

export async function saveReport(input: Draft): Promise<SaveResult> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Something here can't be saved. Check long text.", stale: false };
  const v = parsed.data;
  const { data, error } = await (
    await createClient()
  ).rpc("save_report", { p_id: v.id, p_lock: v.lock, p_summary: v.summary });
  if (error)
    return {
      ok: false,
      message: failure(error).message!,
      stale: ["stale_report", "report_locked", "not_found", "not_allowed"].includes(error.message),
    };
  return { ok: true, version: parseSaved(data).version };
}

export async function submitReport(
  id: string,
  version: number,
  confirmMissing: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (
    !z.uuid().safeParse(id).success ||
    !Number.isInteger(version) ||
    typeof confirmMissing !== "boolean"
  )
    return { ok: false, message: "Something went wrong. Please try again." };
  const { error } = await (
    await createClient()
  ).rpc("submit_report", { p_id: id, p_lock: version, p_confirm_missing: confirmMissing });
  if (error) return { ok: false, message: failure(error).message };
  deliverSoon();
  refresh();
  return { ok: true };
}

export async function setDueDay(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      orgId: z.uuid(),
      day: z.coerce.number("Choose a day.").int().min(1, "Choose a day from 1 to 28.").max(28),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("set_report_due_day", { p_org: input.data.orgId, p_day: input.data.day });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: "Report deadline saved." };
}

const fileInput = uploadInput.extend({
  reportId: z.uuid(),
  field: z.string().max(40).nullable(),
});

export async function startReportFile(input: z.input<typeof fileInput>): Promise<UploadStart> {
  const parsed = fileInput.safeParse(input);
  if (!parsed.success) return badFile;
  const v = parsed.data;
  return uploadLink(
    await (
      await createClient()
    ).rpc("start_report_file", {
      p_report: v.reportId,
      p_field: v.field as string,
      p_name: v.name,
      p_mime: v.type,
      p_size: v.size,
    }),
  );
}

export async function sendLineMessage(_: ActionState, form: FormData): Promise<ActionState> {
  const input = messageInput.extend({ line: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("send_line_message", { p_line: input.data.line, p_body: input.data.body });
  if (error) return failure(error);
  deliverSoon();
  refresh();
  return { ok: true, message: "Message sent." };
}

export async function resolveLineQuestion(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ line: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("resolve_line_question", { p_line: input.data.line });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: "Marked as resolved." };
}

export async function reviewReport(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      id: z.uuid(),
      lock: z.coerce.number().int(),
      decision: z.enum(["approve", "return"]),
      reason: z.string().trim().max(1000),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  if (v.decision === "return" && v.reason.length < 5)
    return { fieldErrors: { reason: ["Say what needs to change, in at least 5 characters."] } };
  const { error } = await (
    await createClient()
  ).rpc("review_report", {
    p_id: v.id,
    p_lock: v.lock,
    p_action: v.decision,
    p_reason: v.reason || (null as unknown as string),
  });
  if (error) return failure(error);
  deliverSoon();
  refresh();
  return { ok: true, message: v.decision === "approve" ? "Report approved." : "Report returned." };
}
