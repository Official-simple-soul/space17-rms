import type { Metadata } from "next";
import Link from "next/link";
import { AccessRequestForm } from "@/features/organisations/components/forms";

export const metadata: Metadata = { title: "Request access" };

export default function RequestAccessPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Request access</h1>
      <p className="text-muted mt-2 mb-8">
        For organisations. Staff should ask their admin for an invitation.
      </p>
      <AccessRequestForm />
      <Link href="/sign-in" className="mt-6 block text-center text-sm font-medium">
        Back to sign in
      </Link>
    </>
  );
}
