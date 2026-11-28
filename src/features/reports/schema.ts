import { z } from "zod";
import { thread } from "@/features/conversations/schema";
import { evidence, expenseFlags, expenseStatus, funding } from "@/features/expenses/schema";
import { attachment } from "@/features/files/schema";

export const STATUSES = {
  draft: "In progress",
  under_review: "With Finance",
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
  summary: z.string(),
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
      thread: thread.nullable(),
      can_message: z.boolean(),
    }),
  ),
  attachments: z.array(attachment),
  waiting: z.number(),
  events: z.array(
    z.object({
      id: z.number(),
      type: z.enum(["submitted", "returned", "approved"]),
      actor: z.string(),
      body: z.string().nullable(),
      at: z.string(),
    }),
  ),
  can_edit: z.boolean(),
  can_review: z.boolean(),
  own_report: z.boolean(),
  open_questions: z.number(),
  decided_by: z.string().nullable(),
  decided_at: z.string().nullable(),
});
export type ReportDetail = z.infer<typeof reportDetail>;

export const draftSchema = z.object({
  id: z.uuid(),
  lock: z.number().int(),
  summary: z.string().max(5000),
});
export type Draft = z.infer<typeof draftSchema>;
