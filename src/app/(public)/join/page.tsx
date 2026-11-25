import type { Metadata } from "next";
import Link from "next/link";
import { JoinCodeForm } from "@/features/members/components/join-views";

export const metadata: Metadata = { title: "Join with a code" };

export default function JoinWithCodePage() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Join with a code</h1>
      <p className="text-muted mt-2 mb-8">Your organisation&apos;s admin can give you the code.</p>
      <JoinCodeForm />
      <Link href="/sign-in" className="mt-6 block text-center text-sm font-medium">
        Back to sign in
      </Link>
    </>
  );
}
