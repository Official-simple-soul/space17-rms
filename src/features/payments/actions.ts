"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { badFile, uploadInput, type UploadStart } from "@/features/files/schema";
import { uploadLink } from "@/features/files/start";
import { deliverSoon } from "@/features/notifications/deliver";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { parseMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { paymentMethod } from "./schema";

const refresh = () => revalidatePath("/o/[orgSlug]", "layout");
const lock = z.coerce.number().int();

export async function recordPayment(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      requestId: z.uuid(),
      lock,
      amount: z
        .string()
        .transform((v) => parseMoney(v) ?? 0)
        .refine((v) => v > 0, "Enter an amount, such as 12,500."),
      paidOn: z.iso.date("Choose the payment date."),
      method: paymentMethod,
      payee: z.enum(["requester", "other"]),
      payeeName: z.string().trim().max(120).optional(),
      reference: z.string().trim().max(80),
      note: z.string().trim().max(500),
    })
    .refine((v) => v.payee === "requester" || (v.payeeName?.length ?? 0) >= 2, {
      path: ["payeeName"],
      message: "Enter who was paid.",
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { error } = await (
    await createClient()
  ).rpc("record_payment", {
    p_request: v.requestId,
    p_lock: v.lock,
    p_amount: v.amount,
    p_paid_on: v.paidOn,
    p_method: v.method,
    p_to_requester: v.payee === "requester",
    p_payee: v.payeeName ?? "",
    p_reference: v.reference,
    p_note: v.note,
  });
  refresh();
  if (error) return failure(error);
  deliverSoon();
  return { ok: true, message: "Payment recorded." };
}

export async function voidPayment(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      id: z.uuid(),
      lock,
      reason: z.string().trim().min(5, "Give a reason of at least 5 characters.").max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("void_payment", {
    p_id: input.data.id,
    p_lock: input.data.lock,
    p_reason: input.data.reason,
  });
  refresh();
  if (error) return failure(error);
  deliverSoon();
  return { ok: true, message: "Payment voided." };
}

export async function confirmPayment(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (await createClient()).rpc("confirm_payment", { p_id: input.data.id });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: "Thanks. Payment confirmed." };
}

export async function revealBankAccount(
  requestId: string,
): Promise<{ number: string } | { message: string }> {
  if (!z.uuid().safeParse(requestId).success) return { message: "Something went wrong." };
  const { data, error } = await (
    await createClient()
  ).rpc("reveal_bank_account", { p_request: requestId });
  return error ? { message: failure(error).message! } : { number: data };
}

const proofInput = uploadInput.extend({ paymentId: z.uuid() });

export async function startProof(input: z.input<typeof proofInput>): Promise<UploadStart> {
  const parsed = proofInput.safeParse(input);
  if (!parsed.success) return badFile;
  const v = parsed.data;
  return uploadLink(
    await (
      await createClient()
    ).rpc("start_payment_proof", {
      p_payment: v.paymentId,
      p_name: v.name,
      p_mime: v.type,
      p_size: v.size,
    }),
  );
}

const repayment = z.object({
  lineId: z.uuid(),
  lock,
  amount: z
    .string()
    .transform((v) => parseMoney(v) ?? 0)
    .refine((v) => v > 0, "Enter an amount, such as 12,500."),
  paidOn: z.iso.date("Choose the payment date."),
  method: paymentMethod,
  reference: z.string().trim().max(80),
  note: z.string().trim().max(500),
});

export async function recordRepayment(_: ActionState, form: FormData): Promise<ActionState> {
  const input = repayment.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { error } = await (
    await createClient()
  ).rpc("record_repayment", {
    p_line: v.lineId,
    p_lock: v.lock,
    p_amount: v.amount,
    p_paid_on: v.paidOn,
    p_method: v.method,
    p_reference: v.reference,
    p_note: v.note,
  });
  refresh();
  if (error) return failure(error);
  deliverSoon();
  return { ok: true, message: "Repayment recorded." };
}

export async function voidRepayment(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      id: z.uuid(),
      lock,
      reason: z.string().trim().min(5, "Give a reason of at least 5 characters.").max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("void_repayment", {
    p_id: input.data.id,
    p_lock: input.data.lock,
    p_reason: input.data.reason,
  });
  refresh();
  if (error) return failure(error);
  deliverSoon();
  return { ok: true, message: "Repayment voided." };
}

export async function confirmRepayment(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (await createClient()).rpc("confirm_repayment", { p_id: input.data.id });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: "Thanks. Repayment confirmed." };
}

export async function revealRepaymentAccount(
  lineId: string,
): Promise<{ number: string } | { message: string }> {
  if (!z.uuid().safeParse(lineId).success) return { message: "Something went wrong." };
  const { data, error } = await (
    await createClient()
  ).rpc("reveal_repayment_account", { p_line: lineId });
  return error ? { message: failure(error).message! } : { number: data };
}
