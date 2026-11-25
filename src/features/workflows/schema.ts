import { z } from "zod";

export const WORKFLOW_SUBJECTS = { request: "Requests", report: "Reports" } as const;
export type WorkflowSubject = keyof typeof WORKFLOW_SUBJECTS;
export const workflowSubject = z.enum(["request", "report"]);
export const APPROVE_PERMISSION = {
  request: "requests.approve",
  report: "reports.review",
} as const satisfies Record<WorkflowSubject, string>;

const APPROVALS = "Approvals needed must be a whole number from 1 to 10.";

export const workflowStep = z
  .object({
    name: z.string().trim().min(2, "Every step needs a name.").max(60),
    approver_type: z.enum(["category_approvers", "role", "member"]),
    role_id: z.uuid("Choose a role for each role step.").nullable(),
    membership_id: z.uuid("Choose a person for each person step.").nullable(),
    min_amount_minor: z
      .number()
      .int()
      .positive("Enter amounts above zero, such as 50,000.")
      .nullable(),
    required_approvals: z.number(APPROVALS).int(APPROVALS).min(1, APPROVALS).max(10, APPROVALS),
  })
  .refine((s) => s.approver_type !== "role" || s.role_id, {
    message: "Choose a role for each role step.",
  })
  .refine((s) => s.approver_type !== "member" || s.membership_id, {
    message: "Choose a person for each person step.",
  });
export type WorkflowStep = z.infer<typeof workflowStep>;

export const workflowSteps = z
  .array(workflowStep)
  .min(1, "Add at least one step.")
  .max(10, "A workflow can have up to 10 steps.")
  .refine(
    (v) => v.some((s) => s.min_amount_minor === null),
    "At least one step must apply to every amount.",
  );
