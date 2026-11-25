"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { deliverSoon } from "@/features/notifications/deliver";
import { getOrganisation } from "@/features/organisations/repository";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { getEmailProvider } from "@/lib/email/provider";
import { optionalId } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailInvitation, emailJoinCheck } from "./email";

const org = z.object({ orgId: z.uuid() });
const refresh = () => revalidatePath("/o/[orgSlug]", "layout");

export async function setJoinCode(_: ActionState, form: FormData): Promise<ActionState> {
  const input = org
    .extend({ enabled: z.enum(["true", "false"]) })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const enabled = input.data.enabled === "true";
  if (enabled && !getEmailProvider())
    return { message: "Set up email first. Join requests need a confirmed email address." };
  const { error } = await (
    await createClient()
  ).rpc("set_join_code", { p_org: input.data.orgId, p_enabled: enabled });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: enabled ? "New join code ready." : "Joining by code is off." };
}

/** Public. Says the same thing whether or not the address is already known. */
export async function requestToJoin(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      code: z.string().trim().min(1, "Enter the code.").max(30),
      name: z.string().trim().min(2, "Enter your full name.").max(120),
      email: z.email("Enter a valid email address.").max(254),
      website: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const done = {
    ok: true,
    message: "Check your email to confirm the request. An admin will then review it.",
  };
  if (v.website) return done; // Hidden field: only bots fill it in.
  if (!getEmailProvider()) return { message: "Joining by code isn't available right now." };
  const { data, error } = await createAdminClient()
    .rpc("submit_join_request", { p_code: v.code, p_name: v.name, p_email: v.email })
    .maybeSingle();
  if (error) return failure(error);
  // After the response, so its timing doesn't reveal whether an email was sent.
  if (data)
    after(async () => {
      await emailJoinCheck(v.email, data.org_name, data.token);
    });
  return done;
}

/** A button press, because mail scanners open links on their own. */
export async function confirmJoinRequest(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return failure({ message: "invite_invalid" });
  const { data, error } = await createAdminClient().rpc("verify_join_request", {
    p_token: input.data.token,
  });
  if (error) return failure(error);
  deliverSoon();
  return {
    ok: true,
    message: `Thanks. ${data} will review your request and email you if it's approved.`,
  };
}

export async function approveJoinRequest(_: ActionState, form: FormData): Promise<ActionState> {
  const input = org
    .extend({ id: z.uuid(), roleId: z.uuid("Choose a role."), departmentId: optionalId })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { data, error } = await (
    await createClient()
  )
    .rpc("approve_join_request", {
      p_org: v.orgId,
      p_id: v.id,
      p_role: v.roleId,
      p_department: v.departmentId ?? undefined,
    })
    .single();
  if (error) return failure(error);
  const { name } = await getOrganisation(v.orgId);
  const sent = await emailInvitation(data.email, name, data.token);
  refresh();
  return sent
    ? { ok: true, message: `Approved. We emailed ${data.email} a link to join.` }
    : {
        ok: true,
        message: "Approved, but the email wasn't sent. Invite them again to get a link to share.",
      };
}

export async function rejectJoinRequest(_: ActionState, form: FormData): Promise<ActionState> {
  const input = org.extend({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("reject_join_request", { p_org: input.data.orgId, p_id: input.data.id });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: "Request rejected." };
}
