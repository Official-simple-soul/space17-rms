import type { z } from "zod";

export type ActionState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  data?: Record<string, string>;
};

const MESSAGES: Record<string, string> = {
  not_allowed: "You don't have permission to do that.",
  mfa_required: "Confirm two-step verification to continue. Open Account → Security.",
  invite_invalid: "This invitation is no longer valid. Ask for a new link.",
  invite_email_mismatch: "This invitation was sent to a different email address.",
  invalid_email: "Enter a valid email address.",
  invalid_timezone: "Choose a valid timezone.",
  reason_required: "Give a reason of at least 5 characters.",
  rate_limited: "Too many requests right now. Try again later.",
  last_admin: "The organisation must keep at least one admin.",
  department_required: "Choose a department for this role.",
  hod_exists:
    "This department already has a head. Remove them first, or set an end date to add a deputy.",
  invalid_date: "Choose a date in the future.",
  department_cycle: "A department can't sit inside itself.",
  department_in_use:
    "Move its people, sub-departments, open invitations and category settings first.",
  department_role_active: "Remove this person's role in that department first.",
  primary_department: "The main department must be one of the selected departments.",
  invalid_permissions: "Some permissions aren't valid.",
  mixed_scopes: "A role can cover a department or the whole organisation, not both.",
  admin_role_locked: "The admin role can't be changed.",
  role_scope_in_use:
    "People hold this role, so it can't switch between department and organisation.",
  role_in_use: "Remove this role from people and open invitations first.",
  own_access: "You can't change your own access.",
  already_member: "This person is already in the organisation.",
  already_configured: "This organisation already has categories.",
  category_exists: "There is already a category with that name.",
  invalid_name: "Enter a name of 2 to 80 characters.",
  category_unavailable: "That category isn't used any more. Choose another, or none.",
  request_locked: "This request can't be changed at this stage.",
  stale_request: "This request has changed since you opened it. Reload to see the latest version.",
  request_incomplete: "Say what you need and why.",
  amount_missing: "Say how much it will cost. Your best guess is fine.",
  provision_missing: "Choose how you'd like it: provided for you, or the money.",
  not_ready: "This isn't ready to hand over yet.",
  note_too_long: "Keep the note under 500 characters.",
  department_unavailable: "You're not in that department. Choose one of yours.",
  no_approver:
    "No one else can approve requests for this department yet. Ask an admin to choose a head for it.",
  department_missing: "Choose a department.",
  invalid_items: "Check the items. Each needs a description, quantity and price.",
  invalid_amounts: "Check the amounts. They can be reduced, but not raised or all set to zero.",
  own_request: "You can't decide your own request.",
  too_many_files: "A request can have up to 20 files.",
  comment_required: "Write a comment.",
  own_payment: "You can't pay your own request. Someone else must do it.",
  overpayment: "Check the amount. It can't be more than the balance.",
  not_payable: "This request isn't waiting for payment.",
  invalid_paid_on: "Choose a payment date within the last year, not in the future.",
  void_closed: "This payment can't be voided any more.",
  too_many_proofs: "A payment can have up to 5 proof files.",
  invalid_account: "Check the account number. Nigerian accounts have 10 digits.",
  join_code_invalid: "That code isn't valid. Check it with your admin.",
  stale_expense: "This has changed since you opened it. Reload to see the latest version.",
  expense_locked: "This expense can't be changed at this stage.",
  expense_incomplete: "Check the expense. It needs a description, date, category and seller.",
  invalid_expense_date: "Choose a date within the last year, not in the future.",
  request_unavailable: "That request can't be linked to this expense.",
  receipt_required: "Add the receipt, or choose No receipt available.",
  receipt_conflict: "Remove the receipt, or choose I have a receipt.",
  no_head: "Your department has no head to review expenses yet. Ask an admin to add one.",
  no_open_report: "There's no open report this expense can go into.",
  too_many_evidence: "An expense can have up to 10 files.",
  stale_report: "This report has changed since you opened it. Reload to see the latest version.",
  report_locked: "This report can't be changed at this stage.",
  invalid_month: "That month isn't available.",
  missing_evidence: "Some expenses have no receipt. Confirm you want to submit anyway.",
  no_reviewer: "No one else can check reports yet. Ask an admin to give someone the Finance role.",
  own_report: "You can't approve a report you sent.",
  open_questions: "Some questions are still open. Resolve them before approving.",
  own_receipt: "You entered this expense, so someone else must issue or void its receipt.",
  cannot_issue: "A receipt can't be issued for this expense now. It may already have one.",
  description_too_long: "Keep the description under 200 characters.",
  receipt_immutable: "An issued receipt can't be changed. Void it and issue a new one.",
  period_closed: "This month is closed, so it can't be changed.",
  reports_outstanding:
    "Some departments aren't settled. Approve their reports or excuse them first.",
  cannot_waive: "Only a department with nothing in its report can be excused.",
  report_not_approved: "Corrections are made to approved reports.",
  own_adjustment: "You proposed this correction, so someone else must decide it.",
  missing_evidence_reason: "Some expenses have no receipt. Add a note saying why you accept them.",
  invalid_action: "Something went wrong. Please try again.",
  department_has_expenses: "This department has expenses or reports in progress.",
  not_found: "That item no longer exists or has already changed.",
};

/** Converts known database errors to safe text; never exposes internals. */
export function failure(error: { message: string; code?: string }): ActionState {
  if (error.code === "23505") return { message: "That value is already in use. Choose another." };
  if (error.code === "23514")
    return { message: "One of the values isn't allowed. Check the form." };
  const known = MESSAGES[error.message];
  if (!known) console.error("Unexpected action error", error.code, error.message);
  return { message: known ?? "Something went wrong. Please try again." };
}

export function invalid(error: z.ZodError): ActionState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) (fieldErrors[String(issue.path[0])] ??= []).push(issue.message);
  return { fieldErrors };
}
