import { z } from "zod";
import { templateFields } from "@/features/templates/schema";

export const STATUSES = {
  draft: "Draft",
  pending: "Awaiting approval",
  returned: "Returned",
  rejected: "Rejected",
  approved: "Approved",
  part_paid: "Part paid",
  paid: "Paid",
  received: "Received",
  accounted: "Accounted for",
  closed: "Closed",
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
  category: named,
  department: named.nullable(),
  requester: z.string(),
  fields: templateFields,
  form_data: z.record(z.string(), z.unknown()),
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
  attachments: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      mime: z.string(),
      size: z.number(),
      field_key: z.string().nullable(),
    }),
  ),
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
});
export type RequestDetail = z.infer<typeof requestDetail>;
export type Attachment = RequestDetail["attachments"][number];

export const draftSchema = z.object({
  orgId: z.uuid(),
  id: z.uuid(),
  lock: z.number().int(),
  categoryId: z.uuid(),
  departmentId: z.uuid().nullable(),
  title: z.string().max(120),
  purpose: z.string().max(2000),
  neededBy: z.iso.date().nullable(),
  form: z.record(z.string(), z.union([z.string().max(5000), z.number(), z.boolean()])),
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
