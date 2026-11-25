import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Card, Notice, PageHeader } from "@/components/ui/surface";
import { ProfileForm } from "@/features/account/components/profile-form";
import { EnrolPanel } from "@/features/auth/components/mfa-panel";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const session = await requireSession();
  return (
    <>
      <PageHeader title="Account" description="Your profile and sign-in security." />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-5 font-semibold">Profile</h2>
          <ProfileForm name={session.name} phone={session.phone} email={session.email} />
        </Card>
        <Card className="p-6">
          <h2 className="mb-5 font-semibold">Security</h2>
          {session.aal === "aal2" ? (
            <Notice>
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4" aria-hidden />
                Two-step verification is on.
              </span>
            </Notice>
          ) : (
            <EnrolPanel next="/account" />
          )}
        </Card>
      </div>
    </>
  );
}
