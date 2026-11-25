import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Notice } from "@/components/ui/surface";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { JoinForm, JoinRegisterForm } from "@/features/members/components/member-forms";
import { findInvitation } from "@/features/members/repository";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Join", referrer: "no-referrer" };

const REASONS: Record<string, string> = {
  used: "This invitation has already been used.",
  revoked: "This invitation was withdrawn.",
  expired: "This invitation has expired.",
};

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const [invite, session] = await Promise.all([findInvitation(token), getSession()]);
  if (!invite || invite.state !== "valid")
    return (
      <>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight">Invitation unavailable</h1>
        <Notice tone="alert">
          {(invite && REASONS[invite.state]) ?? "This link isn't valid."} Ask your admin for a new
          one.
        </Notice>
        <Link href="/sign-in" className={buttonStyles({ className: "mt-6 w-full" })}>
          Go to sign in
        </Link>
      </>
    );
  const other = session && session.email.toLowerCase() !== invite.email;
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Join {invite.org_name}</h1>
      <p className="text-muted mt-2 mb-8">
        {other
          ? "This invitation is for another email address. Sign out, then open the link again."
          : session
            ? "You're signed in and ready to join."
            : invite.has_account
              ? "Sign in to accept your invitation."
              : "Create your account to get started."}
      </p>
      {other ? (
        <SignOutButton className="w-full" />
      ) : session ? (
        <JoinForm token={token} />
      ) : invite.has_account ? (
        <Link
          href={`/sign-in?next=/join/${token}`}
          className={buttonStyles({ className: "w-full" })}
        >
          Sign in
        </Link>
      ) : (
        <JoinRegisterForm token={token} email={invite.email} />
      )}
    </>
  );
}
