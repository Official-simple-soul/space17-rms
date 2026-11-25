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
