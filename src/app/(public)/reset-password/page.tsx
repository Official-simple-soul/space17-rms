import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetForm } from "@/features/auth/components/auth-forms";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New password" };

export default async function ResetPage() {
  const session = await getSession();
  if (!session) redirect("/forgot-password");
  if (session.nextAal === "aal2" && session.aal !== "aal2") redirect("/mfa?next=/reset-password");
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="text-muted mt-2 mb-8">You&apos;ll be signed out on other devices.</p>
      <ResetForm />
    </>
  );
}
