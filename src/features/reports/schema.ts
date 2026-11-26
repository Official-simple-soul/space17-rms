import { z } from "zod";
import { evidence, expenseFlags, expenseStatus, funding } from "@/features/expenses/schema";
import { attachment } from "@/features/files/schema";
import { templateFields } from "@/features/templates/schema";

export const STATUSES = {
  draft: "In progress",
  under_review: "Under review",
  returned: "Returned",
  approved: "Approved",
} as const;
export type ReportStatus = keyof typeof STATUSES;
export const reportStatus = z.enum(Object.keys(STATUSES) as [ReportStatus, ...ReportStatus[]]);

export const reportDetail = z.object({
  id: z.uuid(),
  org_id: z.uuid(),
  number: z.string().nullable(),
  status: reportStatus,
  lock_version: z.number(),
  month: z.string(),
  due_date: z.string(),
  overdue: z.boolean(),
  started: z.boolean(),
  month_over: z.boolean(),
  department: z.object({ id: z.uuid(), name: z.string() }),
  currency: z.string(),
  submitted_by: z.string().nullable(),
  submitted_at: z.string().nullable(),
  fields: templateFields,
  form_data: z.record(z.string(), z.unknown()),
  lines: z.array(
    z.object({
      id: z.uuid(),
      description: z.string(),
      seller: z.string(),
      date: z.string(),
      total_minor: z.number(),
      funding,
      status: expenseStatus,
      evidence,
      flags: expenseFlags,
      by: z.string(),
      category: z.string().nullable(),
    }),
  ),
  attachments: z.array(attachment),
  waiting: z.number(),
  events: z.array(
    z.object({
      id: z.number(),
      type: z.enum(["submitted"]),
      actor: z.string(),
      body: z.string().nullable(),
      at: z.string(),
    }),
  ),
  can_edit: z.boolean(),
});
export type ReportDetail = z.infer<typeof reportDetail>;

export const draftSchema = z.object({
  id: z.uuid(),
  lock: z.number().int(),
  form: z.record(z.string(), z.union([z.string().max(5000), z.number(), z.boolean()])),
});
export type Draft = z.infer<typeof draftSchema>;
