import { MfaNotice } from "@/components/layout/mfa-notice";
import { requireSection } from "@/lib/auth/access";

export default async function ConfigurationLayout({
  children,
  params,
}: LayoutProps<"/o/[orgSlug]/configuration">) {
  const { session } = await requireSection((await params).orgSlug, "configuration");
  return (
    <>
      <MfaNotice aal={session.aal} />
      {children}
    </>
  );
}
