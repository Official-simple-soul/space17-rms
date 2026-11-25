import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { buttonStyles } from "@/components/ui/button";
import { Notice } from "@/components/ui/surface";
import { CreateOrganisationForm, RegisterForm } from "@/features/organisations/components/forms";
import { findInvite } from "@/features/organisations/repository";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Invitation", referrer: "no-referrer" };

const REASONS: Record<string, string> = {
  used: "This invitation has already been used.",
  revoked: "This invitation was withdrawn.",
  expired: "This invitation has expired.",
};

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const [invite, session] = await Promise.all([findInvite(token), getSession()]);

  if (!invite || invite.state !== "valid")
    return (
      <>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight">Invitation unavailable</h1>
        <Notice tone="alert">
          {(invite && REASONS[invite.state]) ?? "This link isn't valid."} Ask for a new one.
        </Notice>
        <Link href="/sign-in" className={buttonStyles({ className: "mt-6 w-full" })}>
          Go to sign in
        </Link>
      </>
    );

  if (session && session.email.toLowerCase() !== invite.email)
    return (
      <>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight">Different account</h1>
        <Notice tone="alert">
          This invitation is for another email address. Sign out, then open the link again.
        </Notice>
        <SignOutButton className="mt-6 w-full" />
      </>
    );

  if (session)
    return (
      <>
        <p className="text-brand text-sm font-medium">Step 2 of 2</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Create your organisation</h1>
        <p className="text-muted mt-2 mb-8">You&apos;ll be its first administrator.</p>
        <CreateOrganisationForm token={token} />
      </>
    );

  return (
    <>
      <p className="text-brand text-sm font-medium">Step 1 of 2</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">You&apos;re invited</h1>
      <p className="text-muted mt-2 mb-8">
        {invite.has_account ? "Sign in to continue." : "Create your account to continue."}
      </p>
      {invite.has_account ? (
        <Link
          href={`/sign-in?next=/invite/${token}`}
          className={buttonStyles({ className: "w-full" })}
        >
          Sign in
        </Link>
      ) : (
        <RegisterForm token={token} email={invite.email} />
      )}
    </>
  );
}
