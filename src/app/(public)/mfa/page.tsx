import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { CodeForm, EnrolPanel } from "@/features/auth/components/mfa-panel";
import { getSession } from "@/lib/auth/session";
import { safePath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Two-step verification" };

export default async function MfaPage({ searchParams }: PageProps<"/mfa">) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const next = safePath((await searchParams).next);
  if (session.aal === "aal2") redirect(next);
  const { data } = await (await createClient()).auth.mfa.listFactors();
  const factor = data?.totp[0];
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Two-step verification</h1>
      <p className="text-muted mt-2 mb-8">
        {factor
          ? "Enter the code from your authenticator app."
          : "Your role needs an extra layer of security."}
      </p>
      {factor ? <CodeForm factorId={factor.id} next={next} /> : <EnrolPanel next={next} />}
      <SignOutButton className="mt-4 w-full" />
    </>
  );
}
