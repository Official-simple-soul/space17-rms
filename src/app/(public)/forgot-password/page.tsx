import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/features/auth/components/auth-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Reset your password</h1>
      <p className="text-muted mt-2 mb-8">We&apos;ll email you a link.</p>
      <ForgotForm />
      <Link href="/sign-in" className="mt-6 block text-center text-sm font-medium">
        Back to sign in
      </Link>
    </>
  );
}
