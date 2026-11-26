"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { badFile, uploadInput, type UploadStart } from "@/features/files/schema";
import { uploadLink } from "@/features/files/start";
import { deliverSoon } from "@/features/notifications/deliver";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { redirectWith } from "@/lib/flash";
import { deleteFiles } from "@/lib/files/storage";
import { parseSaved, readJson } from "@/lib/rpc-json";
import { createClient } from "@/lib/supabase/server";
import { draftSchema, fileKind, type Draft } from "./schema";

const lock = z.coerce.number().int();
const reason = z.string().trim().min(5, "Give a reason of at least 5 characters.").max(1000);
const refresh = () => revalidatePath("/o/[orgSlug]", "layout");

type SaveResult =
  { ok: true; id: string; version: number } | { ok: false; message: string; stale: boolean };

export async function saveExpense(input: Draft): Promise<SaveResult> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Something here can't be saved. Check the date, long text and amounts.",
      stale: false,
    };
  const v = parsed.data;
  // Generated types don't mark nullable arguments.
  const { data, error } = await (
    await createClient()
  ).rpc("save_expense", {
    p_org: v.orgId,
    p_id: v.id as string,
    p_category: v.categoryId as string,
    p_department: v.departmentId as string,
    p_request: v.requestId as string,
    p_date: v.date as string,
    p_description: v.description,
    p_seller: v.seller,
    p_location: v.location,
    p_phone: v.phone,
    p_funding: v.funding,
    p_no_receipt: v.noReceipt,
    p_reason: v.reason,
    p_items: v.items,
    p_lock: v.lock as number,
  });
  if (error)
    return {
      ok: false,
      message: failure(error).message!,
      stale: ["stale_expense", "expense_locked", "not_found"].includes(error.message),
    };
  return { ok: true, ...parseSaved(data) };
}

export async function submitExpense(
  id: string,
  version: number,
): Promise<{ ok: boolean; message?: string }> {
  if (!z.uuid().safeParse(id).success || !Number.isInteger(version))
    return { ok: false, message: "Something went wrong. Please try again." };
  const { error } = await (
    await createClient()
  ).rpc("submit_expense", { p_id: id, p_lock: version });
  if (error) return { ok: false, message: failure(error).message };
  deliverSoon();
  refresh();
  return { ok: true };
}

export async function deleteExpense(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({ slug: z.string().regex(/^[a-z0-9-]+$/), id: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { data, error } = await (
    await createClient()
  ).rpc("delete_expense", { p_id: input.data.id });
  if (error) return failure(error);
  await deleteFiles(data);
  refresh();
  return redirectWith(`/o/${input.data.slug}/expenses`, "Expense deleted.");
}

export async function withdrawExpense(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ id: z.uuid(), lock }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("withdraw_expense", { p_id: input.data.id, p_lock: input.data.lock });
  refresh();
  return error ? failure(error) : { ok: true, message: "Expense withdrawn." };
}

export async function decideExpense(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      id: z.uuid(),
      lock,
      decision: z.enum(["accept", "return", "reject"]),
      reason: z.string().trim().max(1000).default(""),
    })
    .refine((v) => v.decision === "accept" || v.reason.length >= 5, {
      path: ["reason"],
      message: "Give a reason of at least 5 characters.",
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { error } = await (
    await createClient()
  ).rpc("decide_expense", {
    p_id: v.id,
    p_lock: v.lock,
    p_action: v.decision,
    p_reason: v.reason,
  });
  refresh();
  if (error) return failure(error);
  deliverSoon();
  return {
    ok: true,
    message: {
      accept: "Accepted into the report.",
      return: "Returned for changes.",
      reject: "Rejected.",
    }[v.decision],
  };
}

export async function acceptReady(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      orgId: z.uuid(),
      lines: z
        .array(z.object({ id: z.uuid(), lock_version: z.number().int() }))
        .min(1)
        .max(100),
    })
    .safeParse({ orgId: form.get("orgId"), lines: readJson(form.get("lines")) });
  if (!input.success) return invalid(input.error);
  const { data, error } = await (
    await createClient()
  ).rpc("accept_expenses", { p_org: input.data.orgId, p_lines: input.data.lines });
  refresh();
  if (error) return failure(error);
  deliverSoon();
  return { ok: true, message: `${data} accepted into the report.` };
}

export async function removeFromReport(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ id: z.uuid(), lock, reason }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("remove_report_line", {
    p_id: input.data.id,
    p_lock: input.data.lock,
    p_reason: input.data.reason,
  });
  refresh();
  if (error) return failure(error);
  deliverSoon();
  return { ok: true, message: "Removed from the report and returned." };
}

const fileInput = uploadInput.extend({ expenseId: z.uuid(), kind: fileKind });

export async function startExpenseFile(input: z.input<typeof fileInput>): Promise<UploadStart> {
  const parsed = fileInput.safeParse(input);
  if (!parsed.success) return badFile;
  const v = parsed.data;
  return uploadLink(
    await (
      await createClient()
    ).rpc("start_expense_file", {
      p_expense: v.expenseId,
      p_kind: v.kind,
      p_name: v.name,
      p_mime: v.type,
      p_size: v.size,
    }),
  );
}
