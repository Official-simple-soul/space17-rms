"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { password } from "@/features/auth";
import { listDepartments } from "@/features/departments/repository";
import { getOrganisation } from "@/features/organisations/repository";
import { listRoles } from "@/features/roles/repository";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { requireSession } from "@/lib/auth/session";
import { optionalId } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseInvites } from "./csv";
import { emailInvitation, joinLink } from "./email";
import { findInvitation } from "./repository";

const org = z.object({ orgId: z.uuid() });
const member = org.extend({ memberId: z.uuid() });
const refresh = () => revalidatePath("/o/[orgSlug]", "layout");

export async function inviteMember(_: ActionState, form: FormData): Promise<ActionState> {
  const input = org
    .extend({
      email: z.email("Enter a valid email address.").max(254),
      roleId: z.uuid("Choose a role."),
      departmentId: optionalId,
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { data, error } = await (
    await createClient()
  ).rpc("invite_member", {
    p_org: v.orgId,
    p_email: v.email,
    p_role: v.roleId,
    p_department: v.departmentId ?? undefined,
  });
  if (error) return failure(error);
  const { name } = await getOrganisation(v.orgId);
  const sent = await emailInvitation(v.email, name, data);
  refresh();
  return {
    ok: true,
    message: sent
      ? "Invitation emailed. You can also copy the link now; it won't be shown again."
      : "Invitation created. Copy the link now; it won't be shown again.",
    data: { links: `${v.email.toLowerCase()},${joinLink(data)}` },
  };
}

export async function inviteMany(_: ActionState, form: FormData): Promise<ActionState> {
  const input = org.extend({ rows: z.string().max(20_000) }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { rows, errors } = parseInvites(input.data.rows);
  if (!rows.length && !errors.length)
    return { fieldErrors: { rows: ["Add at least one person."] } };
  const [roles, departments] = await Promise.all([
    listRoles(input.data.orgId),
    listDepartments(input.data.orgId),
  ]);
  const resolved = rows.map((row) => {
    const role = roles.find((r) => r.name.toLowerCase() === row.role.toLowerCase());
    const department = departments.find((d) => d.code === row.department.toUpperCase());
    if (!role) errors.push(`Line ${row.line}: there's no role called "${row.role}".`);
    else if (row.department && !department)
      errors.push(`Line ${row.line}: there's no department with code "${row.department}".`);
    else if (role.needsDepartment && !department)
      errors.push(`Line ${row.line}: ${role.name} needs a department code.`);
    return { ...row, role, department };
  });
  // Nothing is sent until every row is valid.
  if (errors.length)
    return {
      message: "Fix these rows, then try again. No one was invited.",
      data: { errors: errors.slice(0, 20).join("\n") },
    };

  const supabase = await createClient();
  const { name } = await getOrganisation(input.data.orgId);
  const emails: { to: string; token: string }[] = [];
  const links: string[] = [];
  const failed: string[] = [];
  for (const row of resolved) {
    const { data, error } = await supabase.rpc("invite_member", {
      p_org: input.data.orgId,
      p_email: row.email,
      p_role: row.role!.id,
      p_department: row.department?.id,
    });
    if (error) failed.push(`${row.email}: ${failure(error).message}`);
    else {
      links.push(`${row.email},${joinLink(data)}`);
      emails.push({ to: row.email, token: data });
    }
  }
  // One at a time, to stay within the email provider's limits.
  after(async () => {
    for (const { to, token } of emails) await emailInvitation(to, name, token);
  });
  refresh();
  return {
    ok: links.length > 0,
    message: `${links.length} of ${rows.length} invited.${links.length ? " Copy the links now; they won't be shown again." : ""}`,
    data: { links: links.join("\n"), errors: failed.join("\n") },
  };
}

export async function revokeInvitation(_: ActionState, form: FormData): Promise<ActionState> {
  const input = org.extend({ id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("revoke_invitation", { p_org: input.data.orgId, p_id: input.data.id });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

export async function grantRole(_: ActionState, form: FormData): Promise<ActionState> {
  const input = member
    .extend({
      roleId: z.uuid("Choose a role."),
      departmentId: optionalId,
      until: z.union([z.iso.date(), z.literal("")]).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { error } = await (
    await createClient()
  ).rpc("grant_role", {
    p_org: v.orgId,
    p_membership: v.memberId,
    p_role: v.roleId,
    p_department: v.departmentId ?? undefined,
    p_until: v.until ? `${v.until}T23:59:59+01:00` : undefined,
  });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: "Role added." };
}

export async function revokeRole(_: ActionState, form: FormData): Promise<ActionState> {
  const input = org.extend({ grantId: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("revoke_role", { p_org: input.data.orgId, p_grant: input.data.grantId });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

export async function setDepartments(_: ActionState, form: FormData): Promise<ActionState> {
  const input = member
    .extend({ departments: z.array(z.uuid()), primary: optionalId })
    .safeParse({ ...Object.fromEntries(form), departments: form.getAll("departments") });
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { error } = await (
    await createClient()
  ).rpc("set_member_departments", {
    p_org: v.orgId,
    p_membership: v.memberId,
    p_departments: v.departments,
    p_primary: v.primary as string,
  });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: "Departments saved." };
}

export async function setStatus(_: ActionState, form: FormData): Promise<ActionState> {
  const input = member
    .extend({
      status: z.enum(["active", "suspended", "left"]),
      reason: z.string(),
      slug: z.string().regex(/^[a-z0-9-]+$/),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const v = input.data;
  const { error } = await (
    await createClient()
  ).rpc("set_member_status", {
    p_org: v.orgId,
    p_membership: v.memberId,
    p_status: v.status,
    p_reason: v.reason,
  });
  if (error) return failure(error);
  refresh();
  if (v.status === "left") redirect(`/o/${v.slug}/members`);
  return { ok: true, message: "Access updated." };
}

const token = z.string().regex(/^[a-f0-9]{64}$/);

export async function registerFromInvitation(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({
      token,
      fullName: z.string().trim().min(2, "Enter your full name.").max(120),
      password,
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const invite = await findInvitation(input.data.token);
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
  if (signedIn.error) redirect(`/sign-in?next=/join/${input.data.token}`);
  return join(input.data.token);
}

async function join(value: string): Promise<ActionState> {
  const { data, error } = await (await createClient()).rpc("accept_invitation", { p_token: value });
  if (error) return failure(error);
  redirect(`/o/${data}`);
}

export async function acceptInvitation(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ token }).safeParse(Object.fromEntries(form));
  if (!input.success) return failure({ message: "invite_invalid" });
  await requireSession();
  return join(input.data.token);
}
