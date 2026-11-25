import type { Metadata } from "next";
import { ConfirmJoinForm } from "@/features/members/components/join-views";

export const metadata: Metadata = { title: "Confirm your email", referrer: "no-referrer" };

export default async function VerifyJoinPage({ params }: PageProps<"/join/verify/[token]">) {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Confirm your email</h1>
      <p className="text-muted mt-2 mb-8">An admin will review your request after this.</p>
      <ConfirmJoinForm token={(await params).token} />
    </>
  );
}
