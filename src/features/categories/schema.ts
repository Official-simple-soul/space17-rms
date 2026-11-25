import { z } from "zod";
import { optionalId } from "@/lib/forms";

export const APPLIES_TO = {
  both: "Requests and expenses",
  request: "Requests only",
  expense: "Expenses only",
} as const;
export type AppliesTo = keyof typeof APPLIES_TO;
export const appliesTo = z.enum(["both", "request", "expense"]);

export const categoryApprover = z
  .object({
    membership_id: z.uuid().nullable(),
    role_id: z.uuid().nullable(),
    department_id: z.uuid().nullable(),
  })
  .refine((a) => (a.membership_id === null) !== (a.role_id === null), {
    message: "Choose a person or role for every approver.",
  });
export type CategoryApprover = z.infer<typeof categoryApprover>;

export const categorySchema = z.object({
  orgId: z.uuid(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  id: optionalId,
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(80),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, "Use 2–10 letters or numbers."),
  appliesTo,
  templateId: optionalId,
  workflowId: optionalId,
  requiresAccounting: z.boolean(),
  departments: z.array(z.uuid()),
  approvers: z.array(categoryApprover).max(50),
});
