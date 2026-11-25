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
  role_in_use: "Remove this role from people, open invitations, categories and workflows first.",
  own_access: "You can't change your own access.",
  already_member: "This person is already in the organisation.",
  invalid_fields: "Check the fields: each needs a label, and dropdowns need different options.",
  invalid_steps: "Check the steps: each needs a name and someone who can approve.",
  invalid_approvers: "Check the approvers.",
  step_always_needed: "At least one step must apply to every amount.",
  stale_version: "Someone published a newer version. Reload the page to see it before saving.",
  template_in_use: "Choose another template in the categories that use this one first.",
  workflow_in_use: "Choose another workflow in the categories that use this one first.",
  already_configured: "This organisation already has its own setup.",
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
