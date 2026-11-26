"use server";

import { redirect } from "next/navigation";
import { env } from "@/config/env";
import { invalid, type ActionState } from "@/lib/action-state";
import { redirectWith } from "@/lib/flash";
import { requireSession } from "@/lib/auth/session";
import { safePath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import { codeSchema, forgotSchema, resetSchema, signInSchema } from "./schema";

export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  const input = signInSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.data.email,
    password: input.data.password,
  });
  if (error)
    return {
      message:
        error.status === 429
          ? "Too many attempts. Wait a moment and try again."
          : "Email or password is incorrect.",
    };
  const next = safePath(input.data.next);
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.nextLevel === "aal2" && data.currentLevel !== "aal2")
    redirect(`/mfa?next=${encodeURIComponent(next)}`);
  return redirectWith(next, "Signed in.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  return redirectWith("/sign-in", "You're signed out.");
}

export async function requestReset(_: ActionState, form: FormData): Promise<ActionState> {
  const input = forgotSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(input.data.email, {
    redirectTo: `${env.appUrl}/auth/callback?next=/reset-password`,
  });
  if (error) console.error("Password reset request failed", error.code);
  // Same answer either way, so accounts cannot be discovered.
  return {
    ok: true,
    message: "If that email has an account, a reset link is on its way. Open it in this browser.",
  };
}

export async function resetPassword(_: ActionState, form: FormData): Promise<ActionState> {
  const input = resetSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: input.data.password });
  if (error)
    return {
      message:
        error.code === "same_password"
          ? "Choose a password you haven't used here."
          : "We couldn't update the password. Request a new link.",
    };
  await supabase.auth.signOut({ scope: "others" });
  return redirectWith("/", "Password changed.");
}

export async function startEnrolment(): Promise<
  { factorId: string; qr: string; secret: string } | { error: string }
> {
  await requireSession();
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp.length) return { error: "Two-step verification is already on." };
  for (const factor of factors?.all.filter((f) => f.status === "unverified") ?? [])
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Authenticator app",
    issuer: "space17 RMS",
  });
  if (error) return { error: "We couldn't start setup. Please try again." };
  // The image ends with a line break, which next/image rejects in development.
  return { factorId: data.id, qr: data.totp.qr_code.trim(), secret: data.totp.secret };
}

export async function verifyCode(_: ActionState, form: FormData): Promise<ActionState> {
  const input = codeSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: input.data.factorId,
    code: input.data.code,
  });
  if (error) return { message: "That code didn't work. Check your app and try again." };
  return redirectWith(safePath(input.data.next), "Code verified.");
}
