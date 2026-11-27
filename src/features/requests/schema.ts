import { z } from "zod";
import { attachment } from "@/features/files/schema";
import { paymentMethod } from "@/features/payments/schema";

export const STATUSES = {
  draft: "Draft",
  pending: "Waiting for approval",
  returned: "Returned",
  rejected: "Rejected",
  approved: "Approved",
  part_paid: "Some money given",
  paid: "Money given",
  received: "Money received",
  accounted: "Accounted for",
  closed: "Done",
  cancelled: "Withdrawn",
} as const;
export type RequestStatus = keyof typeof STATUSES;
export const requestStatus = z.enum(Object.keys(STATUSES) as [RequestStatus, ...RequestStatus[]]);

const named = z.object({ id: z.uuid(), name: z.string() });

export const requestDetail = z.object({
  id: z.uuid(),
  org_id: z.uuid(),
  number: z.string().nullable(),
  title: z.string(),
  purpose: z.string(),
  status: requestStatus,
  total_minor: z.number(),
  approved_minor: z.number().nullable(),
  needed_by: z.string().nullable(),
  submitted_at: z.string().nullable(),
  created_at: z.string(),
  lock_version: z.number(),
  currency: z.string(),
  category: named.nullable(),
  department: named.nullable(),
  requester: z.string(),
  supplier: z.string(),
  items: z.array(
    z.object({
      id: z.uuid(),
      description: z.string(),
      quantity: z.number(),
      unit_price_minor: z.number(),
      line_total_minor: z.number(),
      approved_minor: z.number().nullable(),
    }),
  ),
  attachments: z.array(attachment),
  steps: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      status: z.enum(["waiting", "active", "approved", "returned", "rejected", "cancelled"]),
      who: z.string().nullable(),
      required: z.number(),
      approved: z.number(),
      people: z.array(z.string()),
    }),
  ),
  events: z.array(
    z.object({
      id: z.number(),
      type: z.enum([
        "submitted",
        "approved",
        "returned",
        "rejected",
        "withdrawn",
        "reassigned",
        "commented",
        "paid",
        "payment_voided",
        "payment_confirmed",
      ]),
      actor: z.string(),
      step: z.string().nullable(),
      body: z.string().nullable(),
      amount_minor: z.number().nullable(),
      at: z.string(),
    }),
  ),
  is_requester: z.boolean(),
  my_step: z.uuid().nullable(),
  active_step: z.uuid().nullable(),
  can_comment: z.boolean(),
  already_decided: z.boolean(),
  paid_minor: z.number(),
  payments: z.array(
    z.object({
      id: z.uuid(),
      number: z.string(),
      payee: z.string(),
      amount_minor: z.number(),
      paid_on: z.string(),
      method: paymentMethod,
      reference: z.string().nullable(),
      note: z.string().nullable(),
      status: z.enum(["recorded", "voided"]),
      recorded_by: z.string(),
      void_reason: z.string().nullable(),
      confirmed_at: z.string().nullable(),
      can_add_proof: z.boolean(),
      proofs: z.array(attachment),
    }),
  ),
  can_pay: z.boolean(),
  can_void: z.boolean(),
  bank: z
    .object({
      bank_name: z.string(),
      account_name: z.string(),
      last_digits: z.string(),
      updated_at: z.string(),
    })
    .nullable(),
  needs_bank: z.boolean(),
});
export type RequestDetail = z.infer<typeof requestDetail>;

export const requestOptions = z.object({
  departments: z.array(named.extend({ approvers: z.array(z.string()) })),
  categories: z.array(named),
});
export type RequestOptions = z.infer<typeof requestOptions>;

export const draftSchema = z.object({
  orgId: z.uuid(),
  id: z.uuid().nullable(),
  lock: z.number().int().nullable(),
  departmentId: z.uuid().nullable(),
  categoryId: z.uuid().nullable(),
  title: z.string().max(120),
  purpose: z.string().max(2000),
  neededBy: z.iso.date().nullable(),
  supplier: z.string().max(120),
  items: z
    .array(
      z.object({
        description: z.string().max(200),
        quantity: z.number().min(0).max(100_000),
        unit_price_minor: z.number().int().min(0).max(100_000_000_000),
      }),
    )
    .max(50),
});
export type Draft = z.infer<typeof draftSchema>;
