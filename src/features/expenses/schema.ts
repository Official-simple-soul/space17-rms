import { paymentMethod } from "@/features/payments/schema";
import { z } from "zod";
import { attachment } from "@/features/files/schema";

export const STATUSES = {
  draft: "Draft",
  submitted: "With head of department",
  returned: "Returned",
  rejected: "Rejected",
  accepted: "In report",
  locked: "Approved",
  cancelled: "Withdrawn",
} as const;
export type ExpenseStatus = keyof typeof STATUSES;
export const expenseStatus = z.enum(Object.keys(STATUSES) as [ExpenseStatus, ...ExpenseStatus[]]);

export const FUNDING = { department: "Department funds", personal: "Personal money" } as const;
export const funding = z.enum(["department", "personal"]);

export const EVIDENCE = {
  vendor_receipt: "Receipt",
  internal_receipt: "Our receipt",
  missing: "No receipt",
} as const;
export const evidence = z.enum(["vendor_receipt", "internal_receipt", "missing"]);

export const FLAGS = {
  missing_receipt: "No receipt",
  duplicate: "Possible duplicate",
  duplicate_file: "File used on another expense",
  already_paid: "Request already paid",
  other_month: "From another month",
} as const;
export type ExpenseFlag = keyof typeof FLAGS;
export const expenseFlags = z.array(z.enum(Object.keys(FLAGS) as [ExpenseFlag, ...ExpenseFlag[]]));

/** What a supporting file shows. */
export const PROOF = {
  purchase_photo: "Photo of purchase",
  transfer_proof: "Proof of transfer",
  acknowledgement: "Seller's acknowledgement",
  other: "Other",
} as const;
export const fileKind = z.enum([
  "vendor_receipt",
  "purchase_photo",
  "transfer_proof",
  "acknowledgement",
  "other",
]);
export type FileKind = z.infer<typeof fileKind>;

const named = z.object({ id: z.uuid(), name: z.string() });

export const expenseDetail = z.object({
  id: z.uuid(),
  org_id: z.uuid(),
  description: z.string(),
  date: z.string().nullable(),
  seller: z.string(),
  location: z.string().nullable(),
  phone: z.string().nullable(),
  total_minor: z.number(),
  funding,
  no_receipt: z.boolean(),
  no_receipt_reason: z.string().nullable(),
  status: expenseStatus,
  lock_version: z.number(),
  submitted_at: z.string().nullable(),
  evidence,
  flags: expenseFlags,
  currency: z.string(),
  category: named.nullable(),
  department: named.nullable(),
  request: z
    .object({ id: z.uuid(), number: z.string(), title: z.string(), visible: z.boolean() })
    .nullable(),
  report: z
    .object({
      id: z.uuid(),
      number: z.string().nullable(),
      month: z.string(),
      visible: z.boolean(),
    })
    .nullable(),
  by: z.string(),
  items: z.array(
    z.object({
      id: z.uuid(),
      description: z.string(),
      quantity: z.number(),
      unit_price_minor: z.number(),
      line_total_minor: z.number(),
    }),
  ),
  attachments: z.array(attachment),
  events: z.array(
    z.object({
      id: z.number(),
      type: z.enum([
        "submitted",
        "accepted",
        "returned",
        "rejected",
        "withdrawn",
        "removed",
        "evidence_added",
        "repaid",
        "repayment_voided",
        "repayment_confirmed",
        "receipt_issued",
        "receipt_voided",
      ]),
      actor: z.string(),
      body: z.string().nullable(),
      at: z.string(),
    }),
  ),
  is_mine: z.boolean(),
  can_decide: z.boolean(),
  can_remove: z.boolean(),
  can_add_evidence: z.boolean(),
  repayment: z
    .object({
      payee: z.string(),
      repaid_minor: z.number(),
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
      is_payee: z.boolean(),
    })
    .nullable(),
  receipts: z.array(
    z.object({
      id: z.uuid(),
      number: z.string(),
      status: z.enum(["issued", "voided"]),
      issued_by: z.string(),
      issued_at: z.string(),
      void_reason: z.string().nullable(),
      verify_token: z.string(),
    }),
  ),
  can_issue_receipt: z.boolean(),
  can_void_receipt: z.boolean(),
});
export type ExpenseDetail = z.infer<typeof expenseDetail>;

export const draftSchema = z.object({
  orgId: z.uuid(),
  id: z.uuid().nullable(),
  lock: z.number().int().nullable(),
  categoryId: z.uuid().nullable(),
  departmentId: z.uuid().nullable(),
  requestId: z.uuid().nullable(),
  date: z.iso.date().nullable(),
  description: z.string().max(200),
  seller: z.string().max(120),
  location: z.string().max(160),
  phone: z.string().max(20),
  funding,
  noReceipt: z.boolean(),
  reason: z.string().max(500),
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
