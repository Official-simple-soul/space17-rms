import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/features/auth/components/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="text-muted mt-2 mb-8">Sign in to your account.</p>
      <SignInForm next={typeof next === "string" ? next : undefined} />
      <p className="text-muted mt-8 text-center text-sm">
        New organisation?{" "}
        <Link className="text-ink font-medium underline underline-offset-4" href="/request-access">
          Request access
        </Link>
      </p>
      <p className="text-muted mt-2 text-center text-sm">
        Have a{" "}
        <Link className="text-ink font-medium underline underline-offset-4" href="/join">
          join code
        </Link>
        ?
      </p>
    </>
  );
}
