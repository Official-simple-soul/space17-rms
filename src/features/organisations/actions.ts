"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { redirectWith } from "@/lib/flash";
import { requireSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { findInvite } from "./repository";
import { acceptSchema, accessRequestSchema, organisationSchema, registerSchema } from "./schema";

/** Creates an account only for the email address locked to a valid invitation. */
export async function registerFromInvite(_: ActionState, form: FormData): Promise<ActionState> {
  const input = registerSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const invite = await findInvite(input.data.token);
  if (invite?.state !== "valid") return failure({ message: "invite_invalid" });
  if (invite.has_account) return { message: "You already have an account. Sign in to continue." };
  const { error } = await createAdminClient().auth.admin.createUser({
    email: invite.email,
    password: input.data.password,
    email_confirm: true,
    user_metadata: { full_name: input.data.fullName },
  });
  if (error) {
    console.error("Account creation failed", error.code);
    return {
      message:
        error.code === "weak_password"
          ? "Choose a stronger password."
          : "We couldn't create the account. Please try again.",
    };
  }
  const supabase = await createClient();
  const signedIn = await supabase.auth.signInWithPassword({
    email: invite.email,
    password: input.data.password,
  });
  if (signedIn.error) redirect(`/sign-in?next=/invite/${input.data.token}`);
  return redirectWith(`/invite/${input.data.token}`, "Account created.");
}

export async function acceptInvite(_: ActionState, form: FormData): Promise<ActionState> {
  const input = acceptSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_org_invite", {
    p_token: input.data.token,
    p_name: input.data.name,
    p_slug: input.data.slug,
  });
  if (error) return failure(error);
  return redirectWith(`/o/${data}`, "Organisation created.");
}

export async function updateOrganisation(_: ActionState, form: FormData): Promise<ActionState> {
  const input = organisationSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { error } = await (
    await createClient()
  ).rpc("update_organisation", {
    p_org: v.orgId,
    p_name: v.name,
    p_timezone: v.timezone,
    p_fiscal_month: v.fiscalMonth,
  });
  if (error) return failure(error);
  revalidatePath(`/o/${v.slug}`, "layout");
  return { ok: true, message: "Organisation details saved." };
}

export async function requestAccess(_: ActionState, form: FormData): Promise<ActionState> {
  const input = accessRequestSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const done = {
    ok: true,
    message: "Thanks. We'll review your request and email you if it's approved.",
  };
  if (input.data.website) return done; // Hidden field: only bots fill it in.
  const { error } = await createAdminClient().rpc("submit_access_request", {
    p_org_name: input.data.orgName,
    p_contact_name: input.data.contactName,
    p_email: input.data.email,
    p_message: input.data.message,
  });
  return error ? failure(error) : done;
}
