"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env } from "@/config/env";
import { emailOrganisationInvite } from "@/features/members/email";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";

const id = z.object({ id: z.uuid() });

export async function inviteOrganisation(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({ email: z.email("Enter a valid email address.").max(254) })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { data, error } = await (
    await createClient()
  ).rpc("create_org_invite", { p_email: input.data.email });
  if (error) return failure(error);
  const link = `${env.appUrl}/invite/${data}`;
  const sent = await emailOrganisationInvite(input.data.email, link);
  revalidatePath("/platform");
  return {
    ok: true,
    message: sent
      ? "Invitation emailed. You can also copy the link now; it won't be shown again."
      : "Invitation created. Copy the link now; it won't be shown again.",
    data: { link },
  };
}

export async function revokeInvite(_: ActionState, form: FormData): Promise<ActionState> {
  const input = id.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (await createClient()).rpc("revoke_org_invite", { p_id: input.data.id });
  if (error) return failure(error);
  revalidatePath("/platform");
  return { ok: true };
}

export async function declineRequest(_: ActionState, form: FormData): Promise<ActionState> {
  const input = id.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("decline_access_request", { p_id: input.data.id });
  if (error) return failure(error);
  revalidatePath("/platform");
  return { ok: true };
}

export async function changeStatus(_: ActionState, form: FormData): Promise<ActionState> {
  const input = id
    .extend({ suspended: z.enum(["true", "false"]), reason: z.string() })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("set_organisation_suspended", {
    p_org: input.data.id,
    p_suspended: input.data.suspended === "true",
    p_reason: input.data.reason,
  });
  if (error) return failure(error);
  revalidatePath("/platform");
  return { ok: true, message: "Status updated." };
}
