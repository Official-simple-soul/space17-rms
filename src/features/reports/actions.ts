"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { messageInput } from "@/features/conversations/schema";
import { badFile, uploadInput, type UploadStart } from "@/features/files/schema";
import { uploadLink } from "@/features/files/start";
import { deliverSoon } from "@/features/notifications/deliver";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { parseMoney } from "@/lib/format";
import { redirectWith } from "@/lib/flash";
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

const month = z.iso.date().refine((v) => v.endsWith("-01"), "Choose a month.");

export async function waiveReport(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      orgId: z.uuid(),
      departmentId: z.uuid(),
      month,
      reason: z.string().trim().min(5, "Give a reason of at least 5 characters.").max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { error } = await (
    await createClient()
  ).rpc("waive_report", {
    p_org: v.orgId,
    p_department: v.departmentId,
    p_month: v.month,
    p_reason: v.reason,
  });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: "Department excused for this month." };
}

export async function closePeriod(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({ orgId: z.uuid(), slug: z.string().regex(/^[a-z0-9-]+$/), month })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("close_period", { p_org: input.data.orgId, p_month: input.data.month });
  if (error) return failure(error);
  deliverSoon();
  refresh();
  // Stays on the month just closed, rather than moving to the next open one.
  return redirectWith(
    `/o/${input.data.slug}/reports/months?month=${input.data.month}`,
    "Month closed.",
  );
}

export async function reopenPeriod(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      orgId: z.uuid(),
      month,
      reason: z.string().trim().min(5, "Give a reason of at least 5 characters.").max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("reopen_period", {
    p_org: input.data.orgId,
    p_month: input.data.month,
    p_reason: input.data.reason,
  });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: "Month reopened." };
}

export async function proposeAdjustment(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      reportId: z.uuid(),
      direction: z.enum(["add", "remove"]),
      amount: z
        .string()
        .transform((v) => parseMoney(v) ?? 0)
        .refine((v) => v > 0, "Enter an amount, such as 12,500."),
      reason: z.string().trim().min(5, "Say why, in at least 5 characters.").max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { error } = await (
    await createClient()
  ).rpc("propose_adjustment", {
    p_report: v.reportId,
    p_amount: v.direction === "add" ? v.amount : -v.amount,
    p_reason: v.reason,
  });
  if (error) return failure(error);
  deliverSoon();
  refresh();
  return { ok: true, message: "Adjustment proposed. Someone else must approve it." };
}

export async function decideAdjustment(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      id: z.uuid(),
      decision: z.enum(["approve", "reject"]),
      note: z.string().trim().max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  if (v.decision === "reject" && v.note.length < 5)
    return { fieldErrors: { note: ["Say why, in at least 5 characters."] } };
  const { error } = await (
    await createClient()
  ).rpc("decide_adjustment", { p_id: v.id, p_approve: v.decision === "approve", p_note: v.note });
  if (error) return failure(error);
  deliverSoon();
  refresh();
  return {
    ok: true,
    message: v.decision === "approve" ? "Adjustment approved." : "Adjustment rejected.",
  };
}
